// Marketplace checkout orchestration — Firestore version. Two steps:
// createOrder() records intent at "pending" with nothing captured yet;
// markOrderPaid() moves it to "paid", posts the ledger entries, passes
// title to the buyer and takes the piece off the marketplace. Who calls
// markOrderPaid depends on PAYMENTS_MODE: the Razorpay webhook / status re-read
// verification (payments.controller.ts) in production, or the customer's
// own simulate-payment call in simulated mode. Idempotent on the order.

import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  checkoutTotal,
  displayPriceOf,
  gstIncludedIn,
  marketplaceCheckoutPostings,
  orderStateMachine,
  artworkStateMachine,
  type PricingRates, artistSettlementOf } from "@galleryzone/domain";
import { FirestoreRateConfigStore } from "./firestore-rate-config-store.ts";
import { getArtistSale, postArtistSale } from "./artist-sales.ts";
import { Collections, artworkPricingCol, orderStatusEventsCol, type ArtworkPricingDoc, type OrderDoc, type PaymentDoc } from "./collections.ts";
import { appendArtworkStatus, latestStatusOf, refreshListing } from "./listing-projection.ts";
import { recordSaleTransfer } from "./ownership.ts";
import { DbError } from "./errors.ts";

export class CheckoutError extends DbError {}

export interface CreateOrderInput {
  db: Firestore;
  customerId: string;
  artworkId: string;
  addressId: string;
  idempotencyKey: string;
  /**
   * Live ShipRocket serviceability quote for this specific pickup→drop + weight,
   * resolved by the caller BEFORE invoking createOrder (controller does the HTTP).
   * When present, `ratePaise` overrides `rates.deliveryChargePaise`. When absent
   * (ShipRocket unavailable / no serviceable courier / dev mode without creds),
   * createOrder falls back to the flat rate and records `shippingQuote: null`
   * on the order so the UI can render an "estimated" badge.
   */
  deliveryQuote?: ShippingQuoteSnapshot | undefined;
}

/** Snapshotted on the order so re-visits never show a different number. */
export interface ShippingQuoteSnapshot {
  carrier: string;
  ratePaise: number;
  courierCompanyId: number;
  estimatedDeliveryDays: number | null;
}

export interface CreateOrderResult {
  orderId: string;
  totalPaise: number;
}

export async function createOrder({ db, customerId, artworkId, addressId, idempotencyKey, deliveryQuote }: CreateOrderInput): Promise<CreateOrderResult> {
  // Guard against duplicate orders for the same (customer, artwork) that
  // happen when the client generates a fresh idempotencyKey on each tap
  // (double-tap, React-retry after a flaky network, mobile tap+touch).
  // Returns the existing pending order rather than creating a new one —
  // the customer continues the exact checkout they started.
  //
  // CRITICAL (client flag 13 Nov 2026): when a stale pending order is
  // returned, re-price it with the CURRENT delivery quote and pricing rules
  // BEFORE handing back. Otherwise the review step the customer just saw
  // (fresh quote, fresh rates) disagrees with the totalPaise the confirm
  // step then sends to Razorpay — one artwork kept opening Razorpay at
  // ₹165.50 while the review said ₹286. The re-price call snaps the stale
  // order to the number the buyer is looking at right now.
  const existing = await db
    .collection(Collections.orders)
    .where("customerId", "==", customerId)
    .where("artworkId", "==", artworkId)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!existing.empty) {
    const doc = existing.docs[0]!;
    const { totalPaise } = await repricePendingOrder({
      db,
      orderId: doc.id,
      ...(deliveryQuote ? { deliveryQuote, overrideStoredQuote: true } : {}),
    });
    return { orderId: doc.id, totalPaise };
  }

  const pricingSnap = await db.collection(artworkPricingCol(artworkId)).doc("data").get();
  if (!pricingSnap.exists) throw new CheckoutError(`No artwork ${artworkId}`);
  const pricing = pricingSnap.data() as ArtworkPricingDoc;

  // Both of these used to be taken on trust, which meant an order could be
  // opened — and, in razorpay mode, actually paid — for a piece that was
  // never for sale. markOrderPaid would then throw on the marketplace ->
  // sold transition, AFTER the card was charged. Refusing here, before any
  // money moves, is the only safe place for it. It also stops two buyers
  // holding pending orders on the same one-of-a-kind original.
  const artworkStatus = await latestStatusOf(db, artworkId);
  if (artworkStatus !== "marketplace") {
    throw new CheckoutError("This artwork is not available to buy");
  }
  // An aggregator-only piece is sold through galleries; the artist chose that, and the public
  // marketplace already hides it. The id is still guessable, so refuse it here as well.
  const artworkDoc = (await db.collection(Collections.artworks).doc(artworkId).get()).data() as
    | { listingType?: string; displayPricePaise?: number }
    | undefined;
  if (artworkDoc?.listingType === "aggregator_only") {
    throw new CheckoutError("This artwork is not available to buy");
  }

  // An addressId belonging to somebody else would ship the piece to a
  // stranger and leak their address onto this order.
  const addressSnap = await db.collection(Collections.addresses).doc(addressId).get();
  if (!addressSnap.exists || (addressSnap.data() as { userId?: string }).userId !== customerId) {
    throw new CheckoutError(`No address ${addressId}`);
  }

  const rateStore = new FirestoreRateConfigStore(db);
  const activeVersion = await rateStore.getActiveVersion(new Date());
  if (!activeVersion) {
    throw new CheckoutError(
      "No approved rate_config_versions row exists yet — seed one via the admin rules console before checkout can run.",
    );
  }
  const rates: PricingRates = activeVersion.rates;

  // Single source of truth: the artwork doc's stored displayPricePaise is
  // what the buyer saw on the marketplace card AND what the quote endpoint
  // returned — using displayPriceOf(artistPrice, currentRates) here would
  // drift the moment an admin edits platformMarkup, and charge a total
  // different from what the review step just quoted the buyer (client
  // flag 12 Nov 2026: "on one painting the Razorpay amount differed from
  // the review screen, on others it matched"). Fall back to the derived
  // value only if the artwork doc somehow lacks the field.
  const displayPrice = artworkDoc?.displayPricePaise ?? displayPriceOf(pricing.artistPricePaise, rates);
  // When the caller supplied a live ShipRocket quote, override the flat
  // rates.deliveryChargePaise with that courier's actual rate for this
  // pickup→drop + weight. When absent, the fallback kicks in (checkoutTotal's
  // own default) and the order records `shippingQuote: null` so the UI can
  // show "estimated — final at dispatch".
  const checkout = checkoutTotal(displayPrice, rates, deliveryQuote?.ratePaise);
  const gstPaise = gstIncludedIn(displayPrice, rates);

  const orderRef = db.collection(Collections.orders).doc();
  const orderDoc: OrderDoc = {
    artworkId,
    customerId,
    addressId,
    displayPricePaise: checkout.displayPrice,
    gstPaise,
    deliveryChargePaise: checkout.deliveryCharge,
    convenienceFeePaise: checkout.convenienceFee,
    convenienceGstPaise: checkout.convenienceGst,
    totalPaise: checkout.total,
    status: "pending",
    rateConfigVersionId: activeVersion.id,
    artistId: pricing.artistId,
    artistPricePaise: pricing.artistPricePaise,
    // Freeze the ShipRocket quote (if any) onto the order so re-reads always
    // show the same courier + rate. Null = checkout used the flat fallback,
    // UI can render an "estimated" badge.
    shippingQuote: deliveryQuote ?? null,
    createdAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
  };
  await orderRef.set(orderDoc);
  await db.collection(orderStatusEventsCol(orderRef.id)).add({ status: "pending", changedAt: FieldValue.serverTimestamp() });

  const paymentDoc: PaymentDoc = {
    orderId: orderRef.id,
    provider: "razorpay",
    providerPaymentId: null,
    method: "simulated",
    amountPaise: checkout.total,
    idempotencyKey,
    status: "pending",
    rawWebhookPayload: null,
    createdAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
  };
  // idempotencyKey as the doc ID, same pattern as ledger-repository.ts —
  // a retried checkout request with the same key fails loudly instead of
  // creating a second payment record.
  await db.collection(Collections.payments).doc(idempotencyKey).create(paymentDoc);

  return { orderId: orderRef.id, totalPaise: checkout.total };
}

/**
 * Re-price a pending order against the currently-active pricing rules and a
 * freshly-resolved shipping quote. Used by the Razorpay session endpoint so
 * a pending order resumed days later charges the CURRENT rate, not whatever
 * was frozen the day it was placed.
 *
 * Client-flagged 13 Nov 2026 — a pending order stored a stale snapshot
 * (flat ₹25 delivery, pre-GST fee base) from before Shiprocket was live and
 * before the "fee includes delivery" fix. The review step showed ₹286 (fresh
 * quote) but the Razorpay modal opened at the frozen ₹164 — because the
 * session endpoint was dutifully passing order.totalPaise straight through.
 *
 * Returns the (possibly updated) totalPaise; callers pass it to Razorpay.
 * No-ops if the recomputed total matches the stored one — cheap and
 * idempotent.
 */
export interface RepricePendingOrderInput {
  db: Firestore;
  orderId: string;
  deliveryQuote?: {
    carrier: string;
    ratePaise: number;
    courierCompanyId: number;
    estimatedDeliveryDays: number | null;
  };
  /**
   * `true`  → overwrite the order's stored shippingQuote with the fresh one.
   *            Used by createOrder when a stale pending order is returned —
   *            the customer just saw a new quote on review, that quote now
   *            becomes the contract.
   * `false` (default) → trust the order's stored shippingQuote if present,
   *            only use the fresh one when there is no snapshot at all.
   *            Used by /payment/session on RESUME so Shiprocket's minute-to-
   *            minute volatility doesn't move the amount under the buyer.
   */
  overrideStoredQuote?: boolean;
}

export async function repricePendingOrder({
  db,
  orderId,
  deliveryQuote,
  overrideStoredQuote = false,
}: RepricePendingOrderInput): Promise<{ totalPaise: number; changed: boolean }> {
  const orderRef = db.collection(Collections.orders).doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new CheckoutError(`No order ${orderId}`);
  const order = orderSnap.data() as OrderDoc;
  if (order.status !== "pending") {
    return { totalPaise: order.totalPaise, changed: false };
  }

  const artworkDoc = (await db.collection(Collections.artworks).doc(order.artworkId).get()).data() as
    | { displayPricePaise?: number }
    | undefined;
  const pricingSnap = await db.collection(artworkPricingCol(order.artworkId)).doc("data").get();
  const pricing = pricingSnap.exists ? (pricingSnap.data() as ArtworkPricingDoc) : undefined;
  const activeVersion = await new FirestoreRateConfigStore(db).getActiveVersion(new Date());
  if (!activeVersion) throw new CheckoutError("No active rate config");

  const displayPrice =
    artworkDoc?.displayPricePaise ??
    (pricing ? displayPriceOf(pricing.artistPricePaise, activeVersion.rates) : order.displayPricePaise);

  // Which shipping quote wins:
  //   - overrideStoredQuote=true + fresh deliveryQuote → the fresh quote
  //     replaces the stored one. Used by createOrder on a repeat attempt
  //     for the same (customer, artwork): the buyer just confirmed a new
  //     review screen, that becomes the contract.
  //   - otherwise → trust the order's stored snapshot if it has one; fall
  //     back to the passed-in fresh quote only when the stored one is null.
  //     Used by /payment/session RESUME so Shiprocket's volatile per-call
  //     drift doesn't move the amount under the buyer between review and
  //     Razorpay.
  const storedQuote = order.shippingQuote;
  const useFreshQuote = overrideStoredQuote && deliveryQuote;
  const effectiveQuote = useFreshQuote ? deliveryQuote : (storedQuote ?? deliveryQuote ?? null);
  const effectiveDeliveryPaise = effectiveQuote?.ratePaise;

  const checkout = checkoutTotal(displayPrice, activeVersion.rates, effectiveDeliveryPaise);
  if (checkout.total === order.totalPaise) {
    return { totalPaise: order.totalPaise, changed: false };
  }

  const gstPaise = gstIncludedIn(displayPrice, activeVersion.rates);
  await orderRef.update({
    displayPricePaise: checkout.displayPrice,
    gstPaise,
    deliveryChargePaise: checkout.deliveryCharge,
    convenienceFeePaise: checkout.convenienceFee,
    convenienceGstPaise: checkout.convenienceGst,
    totalPaise: checkout.total,
    rateConfigVersionId: activeVersion.id,
    shippingQuote: effectiveQuote,
  });
  return { totalPaise: checkout.total, changed: true };
}

export interface PaymentCapture {
  method: string;
  providerPaymentId: string | null;
  rawWebhookPayload?: unknown;
  /**
   * Razorpay's ACTUAL fee for this payment (paise). From the webhook's
   * `payload.payment.entity.fee`. Null on simulated payments or when the
   * caller is `verify` (which doesn't have the webhook payload yet — the
   * fee lands later when the webhook fires).
   */
  gatewayFeeActualPaise?: number | null;
  /** The GST on that fee (same payload: `.tax`). */
  gatewayFeeGstActualPaise?: number | null;
}

export interface PaymentConfirmation {
  transactionId: string;
  orderId: string;
  customerId: string;
  artistId: string;
  artworkId: string;
  artworkTitle: string;
  totalPaise: number;
  artistNetPaise: number;
}

/** Simulated capture — only reachable while PAYMENTS_MODE=simulated (orders.controller.ts gates it). */
export function confirmSimulatedPayment(db: Firestore, orderId: string): Promise<PaymentConfirmation> {
  return markOrderPaid(db, orderId, { method: "simulated", providerPaymentId: null });
}

/** Records the gateway's order id against our payment doc so a webhook can find the order. */
export async function attachProviderOrder(db: Firestore, orderId: string, providerOrderId: string): Promise<void> {
  const snap = await db.collection(Collections.payments).where("orderId", "==", orderId).limit(1).get();
  if (snap.empty) throw new CheckoutError(`No payment record for order ${orderId}`);
  await snap.docs[0]!.ref.update({ providerOrderId });
}

export async function orderIdForProviderOrder(db: Firestore, providerOrderId: string): Promise<string | null> {
  const snap = await db.collection(Collections.payments).where("providerOrderId", "==", providerOrderId).limit(1).get();
  return snap.empty ? null : (snap.docs[0]!.data() as PaymentDoc).orderId;
}

/**
 * The other direction: which gateway order did we open for this order of ours?
 *
 * Needed because Razorpay generates its own order id (`order_...`) rather than
 * echoing back one we chose, so it cannot be derived from our order id — it
 * has to be read back from the payment doc that attachProviderOrder wrote.
 * This is what lets the verify route re-read an order's status without
 * trusting the browser to tell us which gateway order to ask about.
 */
export async function providerOrderIdForOrder(db: Firestore, orderId: string): Promise<string | null> {
  const snap = await db.collection(Collections.payments).where("orderId", "==", orderId).limit(1).get();
  return snap.empty ? null : ((snap.docs[0]!.data() as PaymentDoc).providerOrderId ?? null);
}

/** The captured Razorpay payment id for an order, if one was captured. */
export async function providerPaymentIdForOrder(db: Firestore, orderId: string): Promise<string | null> {
  const snap = await db.collection(Collections.payments).where("orderId", "==", orderId).limit(1).get();
  if (snap.empty) return null;
  const payment = snap.docs[0]!.data() as PaymentDoc;
  return payment.providerPaymentId ?? null;
}

/**
 * Mark an order refunded. Admin-only. Called after Razorpay has confirmed
 * the refund so the record and reality agree. Stamps the refund id and
 * timestamp on the order doc; a parallel auditLog entry is written by the
 * controller so the "who/why" trail is kept with the entity, not inside
 * the order.
 *
 * The transition "paid|confirmed|packed → cancelled" is already in the
 * state machine; this helper stamps the refund metadata on top. Delivered
 * orders cannot be refunded here — the piece has shipped.
 */
export async function markOrderRefunded(
  db: Firestore,
  orderId: string,
  detail: { providerRefundId: string; reason: string },
): Promise<void> {
  const ref = db.collection(Collections.orders).doc(orderId);
  await ref.update({
    status: "cancelled",
    refundedAt: FieldValue.serverTimestamp(),
    providerRefundId: detail.providerRefundId,
    refundReason: detail.reason.slice(0, 500),
  });
}

/**
 * Cancel a pending order and return the artwork to the buyer's cart. Used
 * when the buyer closes Razorpay without paying, or by the stale-cleanup
 * sweep. Only works on orders in "pending" — paid orders stay paid.
 *
 * Client flag 14 Nov 2026: pending orders are confusing dead weight in the
 * UI (frozen prices, stale addresses, no way to continue cleanly). This
 * replaces the "Complete payment" flow — abandoned attempts simply bounce
 * the artwork back to cart where the buyer started.
 *
 * Idempotent: a second call on an already-abandoned order is a no-op.
 * Silent on non-existent orders.
 */
export async function abandonPendingOrder(
  db: Firestore,
  orderId: string,
  customerId: string,
): Promise<{ abandoned: boolean }> {
  const orderRef = db.collection(Collections.orders).doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) return { abandoned: false };
  const order = snap.data() as OrderDoc;
  if (order.customerId !== customerId) return { abandoned: false };
  if (order.status !== "pending") return { abandoned: false };

  // Mark it abandoned + put the artwork back in the customer's cart so the
  // buyer lands on their cart next time they open the app, not on a stale
  // order they can't finish.
  await orderRef.update({
    status: "cancelled",
    refundReason: "abandoned_at_payment",
  });
  await db.collection(orderStatusEventsCol(orderId)).add({
    status: "cancelled",
    changedAt: FieldValue.serverTimestamp(),
  });
  const cartRef = db.collection(Collections.carts).doc(customerId);
  const cartSnap = await cartRef.get();
  const existing = (cartSnap.data()?.artworkIds as string[] | undefined) ?? [];
  if (!existing.includes(order.artworkId)) {
    await cartRef.set(
      {
        artworkIds: [...existing, order.artworkId],
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  return { abandoned: true };
}

/**
 * Sweep pending orders older than [staleMinutes] into abandoned+back-to-cart.
 * Called lazily from listCustomerOrders so a user who never completed a
 * checkout doesn't see a growing wall of "pending" clutter in their orders
 * list. Shared implementation with explicit abandonPendingOrder so there is
 * one place where the pending → cancelled transition is written.
 */
export async function sweepStalePendingOrders(
  db: Firestore,
  customerId: string,
  staleMinutes = 30,
): Promise<number> {
  const cutoff = Date.now() - staleMinutes * 60 * 1000;
  const snap = await db
    .collection(Collections.orders)
    .where("customerId", "==", customerId)
    .where("status", "==", "pending")
    .get();
  let count = 0;
  for (const doc of snap.docs) {
    const order = doc.data() as OrderDoc;
    const createdMs = order.createdAt?.toMillis?.() ?? 0;
    if (createdMs > cutoff) continue;
    const { abandoned } = await abandonPendingOrder(db, doc.id, customerId);
    if (abandoned) count += 1;
  }
  return count;
}

export async function markPaymentFailed(db: Firestore, orderId: string, detail: { providerPaymentId: string | null; rawWebhookPayload: unknown }): Promise<void> {
  const snap = await db.collection(Collections.payments).where("orderId", "==", orderId).limit(1).get();
  if (snap.empty) return;
  const payment = snap.docs[0]!.data() as PaymentDoc;
  // A failed attempt never overwrites a capture that already happened.
  if (payment.status === "captured") return;
  await snap.docs[0]!.ref.update({ status: "failed", providerPaymentId: detail.providerPaymentId, rawWebhookPayload: detail.rawWebhookPayload ?? null });
}

/**
 * The one place an order becomes paid. Idempotent: a second call for an
 * already-paid order (webhook after checkout verification, or a retried
 * webhook) returns the same confirmation without posting anything twice —
 * the ledger's idempotencyPrefix and the state machine both guard it.
 */
/**
 * What the sale settles on: the price snapshotted when the buyer's total was fixed. Reading the
 * live price instead let an artist raise it between order and payment and be paid the new figure
 * for money the buyer never sent. Legacy orders (no snapshot) fall back to the live doc.
 */
export function settlementPricingOf(order: Pick<OrderDoc, "artistId" | "artistPricePaise">, live: ArtworkPricingDoc): ArtworkPricingDoc {
  if (order.artistPricePaise === undefined || order.artistId === undefined) return live;
  return { ...live, artistId: order.artistId, artistPricePaise: order.artistPricePaise };
}

export async function markOrderPaid(db: Firestore, orderId: string, capture: PaymentCapture): Promise<PaymentConfirmation> {
  const orderRef = db.collection(Collections.orders).doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new CheckoutError(`No order ${orderId}`);
  const order = orderSnap.data() as OrderDoc;

  if (order.status !== "pending") {
    if (order.status === "cancelled") throw new CheckoutError(`Order ${orderId} was cancelled`);
    return confirmationFor(db, orderId, order, null);
  }
  orderStateMachine.assertTransition(order.status, "paid");

  const pricingSnap = await db.collection(artworkPricingCol(order.artworkId)).doc("data").get();
  if (!pricingSnap.exists) throw new CheckoutError(`No artwork ${order.artworkId}`);
  const pricing = settlementPricingOf(order, pricingSnap.data() as ArtworkPricingDoc);

  const rateStore = new FirestoreRateConfigStore(db);
  const version = await rateStore.getActiveVersion(order.createdAt.toDate());
  if (!version) throw new CheckoutError("Order references a rate_config_version that is no longer resolvable");

  // TDS depends on what the artist has already sold this financial year, so
  // it is decided inside the same transaction that posts the ledger entries.
  const { transactionId } = await postArtistSale(db, {
    artistId: pricing.artistId,
    artistPricePaise: pricing.artistPricePaise,
    channel: "marketplace",
    rates: version.rates,
    saleKey: `order:${orderId}`,
    orderId,
    build: (tdsApplies) =>
      marketplaceCheckoutPostings({ artistId: pricing.artistId, artistPricePaise: pricing.artistPricePaise, rates: version.rates, tdsApplies }),
  });

  await orderRef.update({ status: "paid" });
  await db.collection(orderStatusEventsCol(orderId)).add({ status: "paid", changedAt: FieldValue.serverTimestamp() });

  // Title passes on payment (user decision 2026-09-13; plan.md §3.2 said
  // delivery). Idempotent on orderId. The artwork leaves the marketplace
  // at the same moment — a one-of-a-kind original can't be bought twice.
  await recordSaleTransfer(db, { artworkId: order.artworkId, orderId, buyerId: order.customerId });
  const artworkStatus = await latestStatusOf(db, order.artworkId);
  if (artworkStatus !== "sold") {
    artworkStateMachine.assertTransition(artworkStatus, "sold");
    await appendArtworkStatus(db, order.artworkId, { status: "sold", changedBy: null, reason: `order:${orderId}` });
    // Rebuild the listing projection, or the piece stays advertised as
    // for-sale on the public marketplace after it has been bought.
    //
    // Every other path that moves an artwork's status refreshes the
    // projection; this one did not, and toPublicView() only rebuilds when the
    // projection is MISSING (`artwork.listing ?? refreshListing(...)`) — a
    // stale one is present, so it was served unchanged indefinitely. Two sold
    // pieces sat on the marketplace for 25 hours before this was found.
    //
    // No money was ever at risk: createOrder() re-checks the artwork is for
    // sale before anything is charged, so a second buyer is refused. What it
    // cost was a marketplace that lied and a buyer who hits that refusal.
    await refreshListing(db, order.artworkId, version.rates);
  }
  // The inner update() used to be left unawaited inside the .then(), so this
  // function could return — and the "paid" email go out — before the payment
  // doc was marked captured. A webhook arriving in that window would see a
  // pending capture and could mark it failed.
  const paymentSnap = await db.collection(Collections.payments).where("orderId", "==", orderId).limit(1).get();
  if (!paymentSnap.empty) {
    // `markOrderPaid` is called from both the browser-driven /verify path AND
    // the Razorpay webhook. The actual fee and tax are only present on the
    // webhook payload — `/verify` passes undefined. Writing undefined would
    // nuke a previously-captured value, so skip the field unless the caller
    // supplied it. The webhook that arrives seconds later fills it in.
    const feeUpdate: Record<string, unknown> = {};
    if (capture.gatewayFeeActualPaise !== undefined && capture.gatewayFeeActualPaise !== null) {
      feeUpdate.gatewayFeeActualPaise = capture.gatewayFeeActualPaise;
    }
    if (capture.gatewayFeeGstActualPaise !== undefined && capture.gatewayFeeGstActualPaise !== null) {
      feeUpdate.gatewayFeeGstActualPaise = capture.gatewayFeeGstActualPaise;
    }
    await paymentSnap.docs[0]!.ref.update({
      status: "captured",
      method: capture.method,
      providerPaymentId: capture.providerPaymentId,
      rawWebhookPayload: capture.rawWebhookPayload ?? null,
      ...feeUpdate,
    });
  }

  return confirmationFor(db, orderId, order, transactionId);
}

async function confirmationFor(db: Firestore, orderId: string, order: OrderDoc, transactionId: string | null): Promise<PaymentConfirmation> {
  const [artworkSnap, pricingSnap] = await Promise.all([
    db.collection(Collections.artworks).doc(order.artworkId).get(),
    db.collection(artworkPricingCol(order.artworkId)).doc("data").get(),
  ]);
  const live = pricingSnap.data() as ArtworkPricingDoc | undefined;
  const pricing = live && settlementPricingOf(order, live);
  const rateStore = new FirestoreRateConfigStore(db);
  const version = await rateStore.getActiveVersion(order.createdAt.toDate());
  const artworkTitle = (artworkSnap.data() as { title?: string } | undefined)?.title ?? "your artwork";
  // What was actually paid out is on the sale record. An order paid before
  // sales were recorded has none; it falls back to the artist's price, which
  // the old rules only ever moved by 0.1% TDS.
  const sale = await getArtistSale(db, `order:${orderId}`);
  return {
    transactionId: transactionId ?? `order:${orderId}`,
    orderId,
    customerId: order.customerId,
    artistId: pricing?.artistId ?? "",
    artworkId: order.artworkId,
    artworkTitle,
    totalPaise: order.totalPaise,
    artistNetPaise: sale?.netPaise ?? (pricing && version ? artistSettlementOf(pricing.artistPricePaise, "marketplace", version.rates).net : 0),
  };
}
