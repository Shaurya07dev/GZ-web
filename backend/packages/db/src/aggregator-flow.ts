// Aggregator reserve -> sale flow — Firestore version. Same
// simplifications as the Postgres version, documented there and carried
// over: cycleStartedAt is derived from the artwork's earliest holding
// (Firestore has no dedicated cycle-id field either), and a sale reads
// whichever rate is active AT SALE TIME rather than pinning a version at
// reservation.

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
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
import { FirestoreRateConfigStore } from "./firestore-rate-config-store.ts";
import { postLedgerEntries } from "./ledger-repository.ts";
import { Collections, artworkPricingCol, type AggregatorHoldingDoc, type AggregatorSaleDoc, type ArtworkPricingDoc } from "./collections.ts";
import { appendArtworkStatus, latestStatusOf, refreshListing } from "./listing-projection.ts";
import { artworkStateMachine } from "@galleryzone/domain";

export class AggregatorFlowError extends Error {}

async function requireActiveRates(db: Firestore): Promise<PricingRates> {
  const store = new FirestoreRateConfigStore(db);
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
  db: Firestore;
  aggregatorId: string;
  artworkId: string;
}): Promise<ReserveHoldingResult> {
  const pricingSnap = await db.collection(artworkPricingCol(artworkId)).doc("data").get();
  if (!pricingSnap.exists) throw new AggregatorFlowError(`No artwork ${artworkId}`);
  const pricing = pricingSnap.data() as ArtworkPricingDoc;

  const rates = await requireActiveRates(db);

  // Only a live piece can leave for a gallery; someone else's hold wins.
  const artworkStatus = await latestStatusOf(db, artworkId);
  if (artworkStatus !== "marketplace") throw new AggregatorFlowError("This artwork is no longer available to reserve");
  const activeSnap = await db.collection(Collections.aggregatorHoldings).where("artworkId", "==", artworkId).where("status", "==", "reserved").limit(1).get();
  if (!activeSnap.empty) throw new AggregatorFlowError("Another gallery has already reserved this artwork");

  const priorSnap = await db.collection(Collections.aggregatorHoldings).where("artworkId", "==", artworkId).orderBy("assignedAt").get();
  const priorHoldings = priorSnap.docs.map((d) => d.data() as AggregatorHoldingDoc);

  const month = priorHoldings.length + 1;
  const now = new Date();
  const cycleStartedAt = priorHoldings[0]?.assignedAt.toDate() ?? now;

  const offerPricePaise = aggregatorOfferPriceOf(pricing.artistPricePaise, month, rates);
  const displayPricePaise = withGst(offerPricePaise, rates);
  const advance = aggregatorAdvanceForMonth({ month, displayPrice: displayPricePaise, artistPrice: pricing.artistPricePaise, rates, previousAggregatorChangedPrice: false });
  const window = placementWindow({ cycleStartedAt, assignedAt: now, rates });

  const holdingRef = db.collection(Collections.aggregatorHoldings).doc();
  const doc: AggregatorHoldingDoc = {
    artworkId,
    aggregatorId,
    cycleMonth: month,
    advancePercent: Math.round(advance.rate * 100),
    advanceAmountPaise: advance.advance,
    deliveryDepositPaise: advance.deliveryCharge,
    displayPricePaise,
    assignmentSource: "self_reserved",
    assignedAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(window.expiresAt),
    windowExtended: window.extended,
    status: "reserved",
    returnedAt: null,
  };
  await holdingRef.set(doc);

  await postLedgerEntries(db, {
    postings: aggregatorAdvancePostings({ aggregatorId, displayPricePaise, rates }),
    idempotencyPrefix: `holding:${holdingRef.id}:advance`,
    relatedHoldingId: holdingRef.id,
  });

  artworkStateMachine.assertTransition("marketplace", "with_aggregator");
  await appendArtworkStatus(db, artworkId, { status: "with_aggregator", changedBy: aggregatorId, reason: `holding:${holdingRef.id}` });
  await refreshListing(db, artworkId, rates);

  return { holdingId: holdingRef.id, advanceAmountPaise: advance.advance, displayPricePaise, expiresAt: window.expiresAt };
}

export interface RecordSaleInput {
  db: Firestore;
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
  const holdingRef = db.collection(Collections.aggregatorHoldings).doc(holdingId);
  const holdingSnap = await holdingRef.get();
  if (!holdingSnap.exists) throw new AggregatorFlowError(`No holding ${holdingId}`);
  const holding = holdingSnap.data() as AggregatorHoldingDoc;
  holdingStateMachine.assertTransition(holding.status, "sold_pending_settlement");

  const pricingSnap = await db.collection(artworkPricingCol(holding.artworkId)).doc("data").get();
  if (!pricingSnap.exists) throw new AggregatorFlowError(`No artwork ${holding.artworkId}`);
  const pricing = pricingSnap.data() as ArtworkPricingDoc;

  const rates = await requireActiveRates(db);

  const postings = aggregatorSalePostings({
    artistId: pricing.artistId,
    aggregatorId: holding.aggregatorId,
    displayPricePaise: holding.displayPricePaise,
    artistPricePaise: pricing.artistPricePaise,
    advanceAlreadyHeldPaise: holding.advanceAmountPaise,
    rates,
  });

  const saleRef = db.collection(Collections.aggregatorSales).doc();
  const saleDoc: AggregatorSaleDoc = {
    holdingId,
    artworkId: holding.artworkId,
    soldPricePaise: input.soldPricePaise,
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail,
    buyerPhone: input.buyerPhone ?? null,
    deliveryAddress: input.deliveryAddress ?? null,
    deliveryMode: input.deliveryMode,
    paymentRoute: input.paymentRoute,
    remittedAt: null,
    shipmentStatus: "preparing",
    dispatchedAt: null,
    deliveredAt: null,
    courierRef: null,
    soldAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
  };
  await saleRef.set(saleDoc);

  const { transactionId } = await postLedgerEntries(db, {
    postings,
    idempotencyPrefix: `sale:${saleRef.id}`,
    relatedHoldingId: holdingId,
  });

  await holdingRef.update({ status: "sold_pending_settlement" });
  const artworkStatus = await latestStatusOf(db, holding.artworkId);
  if (artworkStatus === "with_aggregator") {
    await appendArtworkStatus(db, holding.artworkId, { status: "sold", changedBy: holding.aggregatorId, reason: `sale:${saleRef.id}` });
    await refreshListing(db, holding.artworkId, rates);
  }

  return { saleId: saleRef.id, transactionId };
}
