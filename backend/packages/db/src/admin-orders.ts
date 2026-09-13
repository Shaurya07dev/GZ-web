// Admin order detail + fulfillment status transitions — Firestore version.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { orderStateMachine, type OrderStatus } from "@galleryzone/domain";
import { Collections, orderStatusEventsCol, type AddressDoc, type OrderDoc } from "./collections.ts";

export class AdminOrderError extends Error {}

export async function listOrdersAdmin(db: Firestore): Promise<(OrderDoc & { id: string })[]> {
  const snap = await db.collection(Collections.orders).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }));
}

export async function getOrderAdmin(db: Firestore, orderId: string): Promise<(OrderDoc & { id: string }) | null> {
  const snap = await db.collection(Collections.orders).doc(orderId).get();
  return snap.exists ? { id: snap.id, ...(snap.data() as OrderDoc) } : null;
}

export async function getAddressAdmin(db: Firestore, addressId: string): Promise<(AddressDoc & { id: string }) | null> {
  const snap = await db.collection(Collections.addresses).doc(addressId).get();
  return snap.exists ? { id: snap.id, ...(snap.data() as AddressDoc) } : null;
}

/** Advances real order fulfillment — confirmed→packed→transit→delivered, or cancelled from an early state. */
export async function advanceOrderStatus(db: Firestore, orderId: string, to: OrderStatus): Promise<void> {
  const ref = db.collection(Collections.orders).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new AdminOrderError(`No order ${orderId}`);
  const order = snap.data() as OrderDoc;
  orderStateMachine.assertTransition(order.status, to);

  await db.runTransaction(async (tx) => {
    tx.update(ref, { status: to });
    tx.set(db.collection(orderStatusEventsCol(orderId)).doc(), { status: to, changedAt: FieldValue.serverTimestamp() });
  });
}
