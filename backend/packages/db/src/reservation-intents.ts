// Aggregator reservation payment intents. Replaces the old wallet-balance
// model: the aggregator now pays per reservation through Razorpay, and the
// holding is only created AFTER the payment is captured AND the allocation
// is still free. See collections.ts/ReservationIntentDoc for the full
// state-machine comment.
//
// Three operations matter here:
//   createReservationIntent       — opens an intent, locks the amount, is idempotent
//   finalizeReservationIntent     — atomic: if the race is lost, needs_refund; else write holding
//   markIntentRefunded            — once the gateway refund succeeds
//
// Everything else is simple reads and status moves. The transaction in
// finalize is the whole correctness story — any change there needs a
// concurrent test.

import { Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import {
  Collections,
  type AggregatorHoldingDoc,
  type ArtworkDoc,
  type ArtworkPricingDoc,
  type ReservationIntentDoc,
  type ReservationIntentStatus,
  artworkPricingCol,
} from "./collections.ts";
import {
  aggregatorAdvanceForMonth,
  aggregatorOfferPriceOf,
  canPlaceWithAnotherAggregator,
  isPriceWarning,
  placementWindow,
  withGst,
  type HoldingStatus,
  type PricingRates,
} from "@galleryzone/domain";
import { FirestoreRateConfigStore } from "./firestore-rate-config-store.ts";
import { DbError } from "./errors.ts";

async function requireActiveRates(db: Firestore): Promise<PricingRates> {
  const store = new FirestoreRateConfigStore(db);
  const version = await store.getActiveVersion(new Date());
  if (!version) throw new ReservationIntentError("No approved rate_config_versions row exists yet");
  return version.rates;
}

export class ReservationIntentError extends DbError {}

export interface ReservationIntentRow extends Omit<ReservationIntentDoc, "createdAt" | "expiresAt" | "paidAt" | "finalizedAt" | "refundedAt"> {
  id: string;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  finalizedAt: string | null;
  refundedAt: string | null;
}

// The buyer gets 15 minutes to complete payment before the intent is treated
// as abandoned. Short enough that an abandoned flow doesn't block the
// artwork from being reserved by someone else for long; long enough that a
// slow 3-D Secure doesn't time out mid-approval.
const INTENT_TTL_MS = 15 * 60 * 1000;

const ACTIVE_HOLDING_STATUSES: ReadonlySet<HoldingStatus> = new Set<HoldingStatus>([
  "reserved",
  "sold_pending_settlement",
]);

const OPEN_INTENT_STATUSES: ReadonlySet<ReservationIntentStatus> = new Set<ReservationIntentStatus>([
  "created",
  "paid",
]);

function toRow(id: string, d: ReservationIntentDoc): ReservationIntentRow {
  return {
    id,
    aggregatorId: d.aggregatorId,
    artworkId: d.artworkId,
    sellingPricePaise: d.sellingPricePaise,
    advanceAmountPaise: d.advanceAmountPaise,
    deliveryDepositPaise: d.deliveryDepositPaise,
    totalPayablePaise: d.totalPayablePaise,
    idempotencyKey: d.idempotencyKey,
    providerOrderId: d.providerOrderId,
    providerPaymentId: d.providerPaymentId,
    providerRefundId: d.providerRefundId,
    holdingId: d.holdingId,
    failureReason: d.failureReason,
    status: d.status,
    createdAt: d.createdAt.toDate().toISOString(),
    expiresAt: d.expiresAt.toDate().toISOString(),
    paidAt: d.paidAt?.toDate().toISOString() ?? null,
    finalizedAt: d.finalizedAt?.toDate().toISOString() ?? null,
    refundedAt: d.refundedAt?.toDate().toISOString() ?? null,
  };
}

export interface CreateReservationIntentInput {
  aggregatorId: string;
  artworkId: string;
  /** Optional month-1 pricing; omitted = GalleryZone's offer. */
  sellingPricePaise?: number | undefined;
  idempotencyKey: string;
}

export interface CreateReservationIntentResult {
  intent: ReservationIntentRow;
  /** Was this a fresh intent (new Razorpay order needed) or the idempotent return of an existing one? */
  reused: boolean;
}

/**
 * Lock the amount and open an intent. Does NOT touch Razorpay — the controller
 * attaches the provider order id after calling the gateway. Idempotent: the
 * same key within TTL returns the same intent (no second Razorpay order).
 *
 * Rejects early if the artwork isn't reservable at all (not marketplace, held
 * by this aggregator before, cycle exhausted, no listing days left). The
 * finalize transaction re-checks everything that could change in flight.
 */
export async function createReservationIntent(db: Firestore, input: CreateReservationIntentInput): Promise<CreateReservationIntentResult> {
  // Idempotency check: same key still in a usable state → return it as-is.
  const existingSnap = await db
    .collection(Collections.reservationIntents)
    .where("aggregatorId", "==", input.aggregatorId)
    .where("idempotencyKey", "==", input.idempotencyKey)
    .limit(1)
    .get();
  if (!existingSnap.empty) {
    const doc = existingSnap.docs[0]!;
    const existing = doc.data() as ReservationIntentDoc;
    if (OPEN_INTENT_STATUSES.has(existing.status) && existing.expiresAt.toMillis() > Date.now()) {
      return { intent: toRow(doc.id, existing), reused: true };
    }
    // Expired / cancelled / already-finalized key: treat as a fresh request.
    // The caller must supply a new key to retry.
    throw new ReservationIntentError("This reservation has already been processed. Start a new one.");
  }

  const rates = await requireActiveRates(db);
  const { pricing, artwork } = await loadArtworkForReservation(db, input.artworkId);
  const monthContext = await loadMonthContext(db, input.artworkId, input.aggregatorId);
  const offerPricePaise = aggregatorOfferPriceOf(pricing.artistPricePaise, monthContext.month, rates, {
    appreciated: monthContext.appreciated,
  });

  // Validate sellingPrice: month 1 can price above offer, else must equal offer.
  const sellingPricePaise = resolveSellingPrice(input.sellingPricePaise, offerPricePaise, monthContext.month);
  const advance = aggregatorAdvanceForMonth({
    month: monthContext.month,
    sellingPrice: sellingPricePaise,
    artistPrice: pricing.artistPricePaise,
    rates,
  });
  // Light pre-check so the aggregator doesn't pay for an artwork someone else
  // just reserved. The finalize transaction is the authoritative gate.
  if (!monthContext.canPlace) {
    throw new ReservationIntentError("This artwork has no aggregator placement left in its listing period");
  }
  if (!artwork.listing || artwork.listing.status !== "marketplace") {
    throw new ReservationIntentError("This artwork is no longer available to reserve");
  }

  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + INTENT_TTL_MS);
  const doc: ReservationIntentDoc = {
    aggregatorId: input.aggregatorId,
    artworkId: input.artworkId,
    sellingPricePaise: input.sellingPricePaise ?? null,
    advanceAmountPaise: advance.advance,
    deliveryDepositPaise: advance.deliveryCharge,
    totalPayablePaise: advance.payable,
    idempotencyKey: input.idempotencyKey,
    providerOrderId: null,
    providerPaymentId: null,
    providerRefundId: null,
    holdingId: null,
    failureReason: null,
    status: "created",
    createdAt: Timestamp.fromMillis(now),
    expiresAt,
    paidAt: null,
    finalizedAt: null,
    refundedAt: null,
  };
  const ref = await db.collection(Collections.reservationIntents).add(doc);
  return { intent: toRow(ref.id, doc), reused: false };
}

export async function attachIntentProviderOrder(db: Firestore, intentId: string, providerOrderId: string): Promise<void> {
  await db.collection(Collections.reservationIntents).doc(intentId).update({ providerOrderId });
}

export async function getReservationIntent(db: Firestore, intentId: string): Promise<ReservationIntentRow | null> {
  const snap = await db.collection(Collections.reservationIntents).doc(intentId).get();
  if (!snap.exists) return null;
  return toRow(snap.id, snap.data() as ReservationIntentDoc);
}

export async function intentIdForProviderOrder(db: Firestore, providerOrderId: string): Promise<string | null> {
  const snap = await db
    .collection(Collections.reservationIntents)
    .where("providerOrderId", "==", providerOrderId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0]!.id;
}

export interface FinalizeReservationIntentInput {
  intentId: string;
  /** The aggregator making the finalize request (controller enforces this is the intent's owner). */
  aggregatorId: string;
  /** Razorpay payment id, from the signed callback or the webhook. */
  providerPaymentId: string;
}

export type FinalizeOutcome =
  | { kind: "finalized"; holdingId: string; intent: ReservationIntentRow }
  | { kind: "already_finalized"; holdingId: string; intent: ReservationIntentRow }
  | { kind: "needs_refund"; reason: string; intent: ReservationIntentRow };

/**
 * Atomic finalize: re-check availability under a Firestore transaction and
 * EITHER create the holding + mark the intent finalized, OR mark the intent
 * needs_refund if the race was lost. The controller handles the actual
 * refund call to Razorpay once this returns needs_refund.
 *
 * Idempotent: if the intent is already finalized, returns the existing
 * holding id. If it's already needs_refund / refunded, returns needs_refund.
 */
export async function finalizeReservationIntent(db: Firestore, input: FinalizeReservationIntentInput): Promise<FinalizeOutcome> {
  const rates = await requireActiveRates(db);
  const intentRef = db.collection(Collections.reservationIntents).doc(input.intentId);
  const artworkRef = db.collection(Collections.artworks).doc("placeholder"); // reassigned per-txn

  return db.runTransaction(async (tx) => {
    const intentSnap = await tx.get(intentRef);
    const intent = intentSnap.data() as ReservationIntentDoc | undefined;
    if (!intent) throw new ReservationIntentError(`No reservation intent ${input.intentId}`);
    if (intent.aggregatorId !== input.aggregatorId) throw new ReservationIntentError("Not your intent");

    // Idempotent returns for anything already in a terminal state.
    if (intent.status === "finalized") {
      return { kind: "already_finalized" as const, holdingId: intent.holdingId!, intent: toRow(input.intentId, intent) };
    }
    if (intent.status === "needs_refund" || intent.status === "refunded") {
      return { kind: "needs_refund" as const, reason: intent.failureReason ?? "Already queued for refund", intent: toRow(input.intentId, intent) };
    }
    if (intent.status === "expired" || intent.status === "cancelled") {
      // Payment came in after we gave up. Flip to needs_refund so the controller refunds it.
      const reason = `Intent was ${intent.status} before payment arrived`;
      await markNeedsRefundInTx(tx, intentRef, intent, input.providerPaymentId, reason);
      return { kind: "needs_refund" as const, reason, intent: toRow(input.intentId, { ...intent, status: "needs_refund", providerPaymentId: input.providerPaymentId, failureReason: reason }) };
    }

    // Re-read the artwork, pricing, and ALL holdings for this artwork under the transaction.
    const artworkDocRef = db.collection(Collections.artworks).doc(intent.artworkId);
    const [artworkSnap, pricingSnap, holdingsSnap] = await Promise.all([
      tx.get(artworkDocRef),
      tx.get(db.collection(artworkPricingCol(intent.artworkId)).doc("data")),
      tx.get(db.collection(Collections.aggregatorHoldings).where("artworkId", "==", intent.artworkId)),
    ]);
    const artwork = artworkSnap.data() as ArtworkDoc | undefined;
    const pricing = pricingSnap.data() as ArtworkPricingDoc | undefined;
    if (!artwork || !pricing) {
      return refundAndReturn(tx, intentRef, intent, input.providerPaymentId, "Artwork no longer available");
    }
    if (!artwork.listing || artwork.listing.status !== "marketplace") {
      return refundAndReturn(tx, intentRef, intent, input.providerPaymentId, "Artwork is no longer on the marketplace");
    }
    const priorHoldings = holdingsSnap.docs
      .map((d) => d.data() as AggregatorHoldingDoc)
      .sort((a, b) => a.assignedAt.toMillis() - b.assignedAt.toMillis());
    if (priorHoldings.some((h) => ACTIVE_HOLDING_STATUSES.has(h.status))) {
      return refundAndReturn(tx, intentRef, intent, input.providerPaymentId, "Another aggregator reserved this piece first");
    }
    if (priorHoldings.some((h) => h.aggregatorId === input.aggregatorId)) {
      return refundAndReturn(tx, intentRef, intent, input.providerPaymentId, "You've already held this piece — it goes to a different aggregator next");
    }
    const month = priorHoldings.length + 1;
    const cycleStartedAt = priorHoldings[0]?.assignedAt.toDate() ?? new Date();
    const canPlace = canPlaceWithAnotherAggregator({
      cycleStartedAt: priorHoldings[0]?.assignedAt.toDate() ?? null,
      placementsSoFar: priorHoldings.length,
      rates,
      now: Date.now(),
    });
    if (!canPlace) {
      return refundAndReturn(tx, intentRef, intent, input.providerPaymentId, "This artwork has no aggregator placement left in its listing period");
    }

    // All gates pass — create the holding and mark the intent finalized in the same transaction.
    const offerPricePaise = aggregatorOfferPriceOf(pricing.artistPricePaise, month, rates, {
      appreciated: priorHoldings[0]?.appreciated ?? false,
    });
    const chosenPricePaise = intent.sellingPricePaise ?? offerPricePaise;
    const appreciated = month === 1 && chosenPricePaise > offerPricePaise;
    const priceWarning = month === 1 && isPriceWarning(chosenPricePaise, offerPricePaise, rates);
    const displayPricePaise = withGst(chosenPricePaise, rates);
    const advance = aggregatorAdvanceForMonth({ month, sellingPrice: chosenPricePaise, artistPrice: pricing.artistPricePaise, rates });
    const window = placementWindow({ cycleStartedAt, assignedAt: new Date(), rates });

    const holdingRef = db.collection(Collections.aggregatorHoldings).doc();
    const holding: AggregatorHoldingDoc = {
      artworkId: intent.artworkId,
      aggregatorId: input.aggregatorId,
      cycleMonth: month,
      advancePercent: Math.round(advance.rate * 100),
      advanceAmountPaise: advance.advance,
      deliveryDepositPaise: advance.deliveryCharge,
      displayPricePaise,
      sellingPricePaise: chosenPricePaise,
      appreciated,
      priceWarning,
      assignmentSource: "self_reserved",
      assignedAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(window.expiresAt),
      windowExtended: window.extended,
      status: "reserved",
      returnedAt: null,
    };
    tx.set(holdingRef, holding);
    const finalizedPatch: Partial<ReservationIntentDoc> = {
      status: "finalized",
      providerPaymentId: input.providerPaymentId,
      paidAt: Timestamp.now(),
      finalizedAt: Timestamp.now(),
      holdingId: holdingRef.id,
    };
    tx.update(intentRef, finalizedPatch);
    return {
      kind: "finalized" as const,
      holdingId: holdingRef.id,
      intent: toRow(input.intentId, { ...intent, ...finalizedPatch } as ReservationIntentDoc),
    };
  });
}

function markNeedsRefundInTx(tx: Transaction, intentRef: FirebaseFirestore.DocumentReference, intent: ReservationIntentDoc, providerPaymentId: string, reason: string) {
  tx.update(intentRef, {
    status: "needs_refund",
    providerPaymentId,
    paidAt: intent.paidAt ?? Timestamp.now(),
    failureReason: reason,
  });
}

function refundAndReturn(tx: Transaction, intentRef: FirebaseFirestore.DocumentReference, intent: ReservationIntentDoc, providerPaymentId: string, reason: string): FinalizeOutcome {
  markNeedsRefundInTx(tx, intentRef, intent, providerPaymentId, reason);
  return {
    kind: "needs_refund" as const,
    reason,
    intent: toRow(intentRef.id, { ...intent, status: "needs_refund", providerPaymentId, failureReason: reason, paidAt: intent.paidAt ?? Timestamp.now() } as ReservationIntentDoc),
  };
}

/** Called by the controller after Razorpay successfully refunds the money. */
export async function markIntentRefunded(db: Firestore, intentId: string, providerRefundId: string): Promise<void> {
  await db.collection(Collections.reservationIntents).doc(intentId).update({
    status: "refunded",
    providerRefundId,
    refundedAt: Timestamp.now(),
  });
}

/** Called when the buyer confirmed-cancel OR verify saw Razorpay never charged. */
export async function markIntentCancelled(db: Firestore, intentId: string, reason: string): Promise<void> {
  const ref = db.collection(Collections.reservationIntents).doc(intentId);
  // Guard against a race where webhook finalizes just as we try to cancel.
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.data() as ReservationIntentDoc | undefined;
    if (!existing) return;
    if (existing.status !== "created") return;
    tx.update(ref, { status: "cancelled", failureReason: reason });
  });
}

// --- helpers -----------------------------------------------------------------

async function loadArtworkForReservation(db: Firestore, artworkId: string): Promise<{ pricing: ArtworkPricingDoc; artwork: ArtworkDoc }> {
  const [artworkSnap, pricingSnap] = await Promise.all([
    db.collection(Collections.artworks).doc(artworkId).get(),
    db.collection(artworkPricingCol(artworkId)).doc("data").get(),
  ]);
  const artwork = artworkSnap.data() as ArtworkDoc | undefined;
  const pricing = pricingSnap.data() as ArtworkPricingDoc | undefined;
  if (!artwork) throw new ReservationIntentError(`No artwork ${artworkId}`);
  if (!pricing) throw new ReservationIntentError(`Artwork ${artworkId} has no price set`);
  return { artwork, pricing };
}

interface MonthContext {
  month: number;
  appreciated: boolean;
  canPlace: boolean;
}

async function loadMonthContext(db: Firestore, artworkId: string, aggregatorId: string): Promise<MonthContext> {
  const snap = await db
    .collection(Collections.aggregatorHoldings)
    .where("artworkId", "==", artworkId)
    .get();
  const priorHoldings = snap.docs
    .map((d) => d.data() as AggregatorHoldingDoc)
    .sort((a, b) => a.assignedAt.toMillis() - b.assignedAt.toMillis());
  // Fail fast — the finalize txn re-validates these but there's no reason to
  // let the aggregator start a payment that can't finalize.
  if (priorHoldings.some((h) => h.aggregatorId === aggregatorId)) {
    throw new ReservationIntentError("You've already held this piece. It goes to a different aggregator next.");
  }
  if (priorHoldings.some((h) => ACTIVE_HOLDING_STATUSES.has(h.status))) {
    throw new ReservationIntentError("Another aggregator has reserved this artwork");
  }
  const rates = await requireActiveRates(db);
  const canPlace = canPlaceWithAnotherAggregator({
    cycleStartedAt: priorHoldings[0]?.assignedAt.toDate() ?? null,
    placementsSoFar: priorHoldings.length,
    rates,
    now: Date.now(),
  });
  return {
    month: priorHoldings.length + 1,
    appreciated: priorHoldings[0]?.appreciated ?? false,
    canPlace,
  };
}

function resolveSellingPrice(chosen: number | undefined, offerPricePaise: number, month: number): number {
  if (chosen === undefined || chosen === offerPricePaise) return offerPricePaise;
  if (month > 1) throw new ReservationIntentError("The selling price is set by GalleryZone after month 1");
  if (chosen < offerPricePaise) throw new ReservationIntentError("The selling price can't go below GalleryZone's offer");
  return chosen;
}
