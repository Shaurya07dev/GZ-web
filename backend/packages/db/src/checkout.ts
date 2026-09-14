// Marketplace checkout orchestration — Firestore version. Same two-step
// design as the Postgres version: createOrder() records intent at
// "pending" with nothing captured yet; confirmSimulatedPayment() is the
// explicit PRE-RAZORPAY placeholder that moves the order to "paid" and
// posts the real ledger entries. Phase 2 replaces confirmSimulatedPayment's
// body with real webhook handling, not its callers.

import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  checkoutTotal,
  displayPriceOf,
  gstIncludedIn,
  marketplaceCheckoutPostings,
  orderStateMachine,
  artworkStateMachine,
  type PricingRates,
} from "@galleryzone/domain";
import { FirestoreRateConfigStore } from "./firestore-rate-config-store.ts";
import { postLedgerEntries } from "./ledger-repository.ts";
import { Collections, artworkPricingCol, orderStatusEventsCol, type ArtworkPricingDoc, type OrderDoc, type PaymentDoc } from "./collections.ts";
import { appendArtworkStatus, latestStatusOf } from "./listing-projection.ts";
import { recordSaleTransfer } from "./ownership.ts";

export class CheckoutError extends Error {}

export interface CreateOrderInput {
  db: Firestore;
  customerId: string;
  artworkId: string;
  addressId: string;
  idempotencyKey: string;
}

export interface CreateOrderResult {
  orderId: string;
  totalPaise: number;
}

export async function createOrder({ db, customerId, artworkId, addressId, idempotencyKey }: CreateOrderInput): Promise<CreateOrderResult> {
  const pricingSnap = await db.collection(artworkPricingCol(artworkId)).doc("data").get();
  if (!pricingSnap.exists) throw new CheckoutError(`No artwork ${artworkId}`);
  const pricing = pricingSnap.data() as ArtworkPricingDoc;

  const rateStore = new FirestoreRateConfigStore(db);
  const activeVersion = await rateStore.getActiveVersion(new Date());
  if (!activeVersion) {
    throw new CheckoutError(
      "No approved rate_config_versions row exists yet — seed one via the admin rules console before checkout can run.",
    );
  }
  const rates: PricingRates = activeVersion.rates;

  const displayPrice = displayPriceOf(pricing.artistPricePaise, rates);
  const checkout = checkoutTotal(displayPrice, rates);
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
    totalPaise: checkout.total,
    status: "pending",
    rateConfigVersionId: activeVersion.id,
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
 * PRE-RAZORPAY PLACEHOLDER. Simulates a successful payment capture: moves
 * the order pending -> paid and posts the real marketplace-channel ledger
 * entries. Phase 2 replaces this function's body with real Razorpay
 * webhook handling (signature verification, idempotent-by-webhook-id) —
 * callers (and the order/ledger shape it produces) don't change.
 */
export async function confirmSimulatedPayment(db: Firestore, orderId: string): Promise<{ transactionId: string }> {
  const orderRef = db.collection(Collections.orders).doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new CheckoutError(`No order ${orderId}`);
  const order = orderSnap.data() as OrderDoc;

  orderStateMachine.assertTransition(order.status, "paid");

  const pricingSnap = await db.collection(artworkPricingCol(order.artworkId)).doc("data").get();
  if (!pricingSnap.exists) throw new CheckoutError(`No artwork ${order.artworkId}`);
  const pricing = pricingSnap.data() as ArtworkPricingDoc;

  const rateStore = new FirestoreRateConfigStore(db);
  const version = await rateStore.getActiveVersion(order.createdAt.toDate());
  if (!version) throw new CheckoutError("Order references a rate_config_version that is no longer resolvable");

  const postings = marketplaceCheckoutPostings({
    artistId: pricing.artistId,
    artistPricePaise: pricing.artistPricePaise,
    rates: version.rates,
  });

  const { transactionId } = await postLedgerEntries(db, {
    postings,
    idempotencyPrefix: `order:${orderId}`,
    relatedOrderId: orderId,
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
  }
  await db.collection(Collections.payments).where("orderId", "==", orderId).limit(1).get().then((snap) => {
    if (!snap.empty) snap.docs[0]!.ref.update({ status: "captured" });
  });

  return { transactionId };
}
