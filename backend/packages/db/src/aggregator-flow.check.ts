// Integration check for the aggregator reserve -> sale flow, against real
// Postgres.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/aggregator-flow.check.ts

import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { DEFAULT_RATE_SEED, aggregatorOfferPriceOf, withGst } from "@galleryzone/domain";
import { createDb } from "./client.ts";
import { reserveHolding, recordAggregatorSale } from "./aggregator-flow.ts";
import { PostgresRateConfigStore } from "./postgres/rate-config-store.ts";
import { users } from "./schema/identity.ts";
import { artworks } from "./schema/artwork.ts";
import { aggregatorHoldings, aggregatorSales } from "./schema/aggregator.ts";
import { ledgerEntries } from "./schema/ledger.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [artist] = await db.insert(users).values({ firebaseUid: "fb-agg-artist", role: "artist", name: "Agg Test Artist", email: "agg-artist@example.com" }).returning({ id: users.id });
  const [aggregator] = await db.insert(users).values({ firebaseUid: "fb-agg-aggregator", role: "aggregator", name: "Agg Test Aggregator", email: "agg-aggregator@example.com" }).returning({ id: users.id });
  const [approver] = await db.insert(users).values({ firebaseUid: "fb-agg-approver", role: "admin", name: "Rate Approver", email: "rate-approver@example.com" }).returning({ id: users.id });
  if (!artist || !aggregator || !approver) throw new Error("seed failed");

  const artistPricePaise = 100_000_00;
  const [artwork] = await db
    .insert(artworks)
    .values({
      productCode: "GZ-AGG-1",
      artistId: artist.id,
      title: "Aggregator Test Piece",
      description: "d",
      category: "painting",
      medium: "oil",
      artistPricePaise,
      listingType: "aggregator_only",
      editableUntil: new Date(Date.now() + 7 * 86_400_000),
    })
    .returning({ id: artworks.id });
  if (!artwork) throw new Error("seed failed");

  const rateStore = new PostgresRateConfigStore(db);
  const versionId = await rateStore.propose({ rates: DEFAULT_RATE_SEED, effectiveFrom: new Date("2020-01-01"), proposedBy: artist.id, reason: "aggregator-flow.check.ts seed" });
  await rateStore.approve({ versionId, approvedBy: approver.id });

  // --- Reserve (month 1) --------------------------------------------------
  const reserved = await reserveHolding({ db, aggregatorId: aggregator.id, artworkId: artwork.id });

  const expectedOffer = aggregatorOfferPriceOf(artistPricePaise, 1, DEFAULT_RATE_SEED);
  const expectedDisplay = withGst(expectedOffer, DEFAULT_RATE_SEED);
  assert.equal(reserved.displayPricePaise, expectedDisplay, "month-1 display price matches the pricing engine's own offer ladder");
  assert.equal(reserved.advanceAmountPaise, Math.round(expectedDisplay * DEFAULT_RATE_SEED.aggregatorAdvanceRate), "month-1 advance is 5% of the display price");

  const [holdingRow] = await db.select().from(aggregatorHoldings).where(eq(aggregatorHoldings.id, reserved.holdingId));
  assert.equal(holdingRow?.status, "reserved");
  assert.equal(holdingRow?.cycleMonth, 1);

  // --- Record a sale --------------------------------------------------------
  const { saleId, transactionId } = await recordAggregatorSale({
    db,
    holdingId: reserved.holdingId,
    soldPricePaise: reserved.displayPricePaise,
    buyerName: "Test Buyer",
    buyerEmail: "buyer@example.com",
    deliveryMode: "courier",
    paymentRoute: "direct_to_galleryzone",
  });

  const [saleRow] = await db.select().from(aggregatorSales).where(eq(aggregatorSales.id, saleId));
  assert.equal(saleRow?.holdingId, reserved.holdingId);

  const [updatedHolding] = await db.select().from(aggregatorHoldings).where(eq(aggregatorHoldings.id, reserved.holdingId));
  assert.equal(updatedHolding?.status, "sold_pending_settlement");

  const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.transactionId, transactionId));
  const sum = entries.reduce((total, e) => total + e.amountPaise, 0);
  assert.equal(sum, 0, "the sale's postings balance to zero in the real database");

  // Recording a sale against an already-sold holding must be rejected.
  await assert.rejects(
    () => recordAggregatorSale({ db, holdingId: reserved.holdingId, soldPricePaise: 1, buyerName: "x", buyerEmail: "x@example.com", deliveryMode: "courier", paymentRoute: "direct_to_galleryzone" }),
    /Illegal AggregatorHolding transition/,
  );

  // --- A second reservation for the SAME artwork should be month 2 --------
  const reservedAgain = await reserveHolding({ db, aggregatorId: aggregator.id, artworkId: artwork.id });
  const [secondHolding] = await db.select().from(aggregatorHoldings).where(eq(aggregatorHoldings.id, reservedAgain.holdingId));
  assert.equal(secondHolding?.cycleMonth, 2, "cycle month counts prior holdings for this artwork, including the sold one");

  console.log("packages/db/aggregator-flow.ts: reserve -> sale flow verified against real Postgres");
} finally {
  await close();
}
