// Aggregator/consignment orchestration — Phase 3's centerpiece. Same
// pattern as checkout.ts: impure orchestration here, every actual rate/
// pricing calculation delegated to packages/domain.
//
// Known simplification, documented rather than hidden: a holding's
// "cycleStartedAt" (needed for aggregatorOfferPriceOf/placementWindow) is
// derived as the earliest assignedAt among all of an artwork's holdings,
// since the schema doesn't store it as its own column — holdings are
// "never deleted... kept for cycle-month counting" (see the schema file's
// own comment), which is exactly what makes this derivation valid as long
// as an artwork only ever goes through ONE aggregator cycle in its
// lifetime. A piece re-entering the aggregator pool after a full return-
// to-artist cycle would need an explicit cycle id to reset the count —
// flagged here as a Phase 3+ schema gap, not silently assumed away.
//
// Also simplified: unlike orders, holdings don't pin a rate_config_version
// — a sale's commission/settlement always reads whatever rate is active
// AT SALE TIME, not the rate active at reservation time. This mirrors the
// mock frontend's own behavior (no rate-versioning existed there at all)
// but is worth revisiting once real rate changes happen mid-cycle in
// production.

import { eq } from "drizzle-orm";
import {
  aggregatorAdvanceForMonth,
  aggregatorAdvancePostings,
  aggregatorOfferPriceOf,
  aggregatorSalePostings,
  holdingStateMachine,
  placementWindow,
  withGst,
  type PricingRates,
} from "@galleryzone/domain";
import type { Db } from "./client.ts";
import { PostgresRateConfigStore } from "./postgres/rate-config-store.ts";
import { postLedgerEntries } from "./ledger-repository.ts";
import { artworks } from "./schema/artwork.ts";
import { aggregatorHoldings, aggregatorSales } from "./schema/aggregator.ts";

export class AggregatorFlowError extends Error {}

async function requireActiveRates(db: Db): Promise<PricingRates> {
  const store = new PostgresRateConfigStore(db);
  const version = await store.getActiveVersion(new Date());
  if (!version) throw new AggregatorFlowError("No approved rate_config_versions row exists yet");
  return version.rates;
}

export interface ReserveHoldingResult {
  holdingId: string;
  advanceAmountPaise: number;
  displayPricePaise: number;
  expiresAt: Date;
}

export async function reserveHolding({
  db,
  aggregatorId,
  artworkId,
}: {
  db: Db;
  aggregatorId: string;
  artworkId: string;
}): Promise<ReserveHoldingResult> {
  const [artwork] = await db.select({ artistPricePaise: artworks.artistPricePaise }).from(artworks).where(eq(artworks.id, artworkId));
  if (!artwork) throw new AggregatorFlowError(`No artwork ${artworkId}`);

  const rates = await requireActiveRates(db);

  const priorHoldings = await db
    .select({ assignedAt: aggregatorHoldings.assignedAt })
    .from(aggregatorHoldings)
    .where(eq(aggregatorHoldings.artworkId, artworkId))
    .orderBy(aggregatorHoldings.assignedAt);

  const month = priorHoldings.length + 1;
  const now = new Date();
  const cycleStartedAt = priorHoldings[0]?.assignedAt ?? now;

  const offerPricePaise = aggregatorOfferPriceOf(artwork.artistPricePaise, month, rates);
  const displayPricePaise = withGst(offerPricePaise, rates);
  // Aggregators can no longer set their own price (product change, 26 Aug
  // 2026 — see packages/domain/aggregator-cycle.ts's own comment on this),
  // so "did the previous aggregator change the price" is always false now.
  const advance = aggregatorAdvanceForMonth({ month, displayPrice: displayPricePaise, artistPrice: artwork.artistPricePaise, rates, previousAggregatorChangedPrice: false });
  const window = placementWindow({ cycleStartedAt, assignedAt: now, rates });

  const [holding] = await db
    .insert(aggregatorHoldings)
    .values({
      artworkId,
      aggregatorId,
      cycleMonth: month,
      advancePercent: Math.round(advance.rate * 100),
      advanceAmountPaise: advance.advance,
      deliveryDepositPaise: advance.deliveryCharge,
      displayPricePaise,
      assignmentSource: "self_reserved",
      assignedAt: now,
      expiresAt: window.expiresAt,
      windowExtended: window.extended,
      status: "reserved",
    })
    .returning({ id: aggregatorHoldings.id });
  if (!holding) throw new AggregatorFlowError("insert into aggregator_holdings returned no row");

  await postLedgerEntries(db, {
    postings: aggregatorAdvancePostings({ aggregatorId, displayPricePaise, rates }),
    idempotencyPrefix: `holding:${holding.id}:advance`,
    relatedHoldingId: holding.id,
  });

  return { holdingId: holding.id, advanceAmountPaise: advance.advance, displayPricePaise, expiresAt: window.expiresAt };
}

export interface RecordSaleInput {
  db: Db;
  holdingId: string;
  soldPricePaise: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string | undefined;
  deliveryAddress?: string | undefined;
  deliveryMode: "courier" | "self_pickup";
  paymentRoute: "direct_to_galleryzone" | "cash_at_premises";
}

export async function recordAggregatorSale(input: RecordSaleInput): Promise<{ saleId: string; transactionId: string }> {
  const { db, holdingId } = input;
  const [holding] = await db.select().from(aggregatorHoldings).where(eq(aggregatorHoldings.id, holdingId));
  if (!holding) throw new AggregatorFlowError(`No holding ${holdingId}`);
  holdingStateMachine.assertTransition(holding.status, "sold_pending_settlement");

  const [artwork] = await db.select({ artistId: artworks.artistId, artistPricePaise: artworks.artistPricePaise }).from(artworks).where(eq(artworks.id, holding.artworkId));
  if (!artwork) throw new AggregatorFlowError(`No artwork ${holding.artworkId}`);

  const rates = await requireActiveRates(db);

  const postings = aggregatorSalePostings({
    artistId: artwork.artistId,
    aggregatorId: holding.aggregatorId,
    displayPricePaise: holding.displayPricePaise,
    artistPricePaise: artwork.artistPricePaise,
    advanceAlreadyHeldPaise: holding.advanceAmountPaise,
    rates,
  });

  const [sale] = await db
    .insert(aggregatorSales)
    .values({
      holdingId,
      artworkId: holding.artworkId,
      soldPricePaise: input.soldPricePaise,
      buyerName: input.buyerName,
      buyerEmail: input.buyerEmail,
      buyerPhone: input.buyerPhone ?? null,
      deliveryAddress: input.deliveryAddress ?? null,
      deliveryMode: input.deliveryMode,
      paymentRoute: input.paymentRoute,
    })
    .returning({ id: aggregatorSales.id });
  if (!sale) throw new AggregatorFlowError("insert into aggregator_sales returned no row");

  const { transactionId } = await postLedgerEntries(db, {
    postings,
    idempotencyPrefix: `sale:${sale.id}`,
    relatedHoldingId: holdingId,
  });

  await db.update(aggregatorHoldings).set({ status: "sold_pending_settlement" }).where(eq(aggregatorHoldings.id, holdingId));

  return { saleId: sale.id, transactionId };
}
