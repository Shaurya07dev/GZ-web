// Admin order detail + fulfillment status transitions — closes the
// "no order-fulfillment state machine" gap the research pass flagged
// (the mock frontend never drives Order.status past pending/paid).

import { eq } from "drizzle-orm";
import { orderStateMachine, type OrderStatus } from "@galleryzone/domain";
import type { Db } from "./client.ts";
import { orders, orderStatusEvents } from "./schema/order.ts";
import { addresses } from "./schema/identity.ts";

export class AdminOrderError extends Error {}

export async function listOrdersAdmin(db: Db) {
  return db.select().from(orders);
}

export async function getOrderAdmin(db: Db, orderId: string) {
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
  return row ?? null;
}

export async function getAddressAdmin(db: Db, addressId: string) {
  const [row] = await db.select().from(addresses).where(eq(addresses.id, addressId));
  return row ?? null;
}

/** Advances real order fulfillment — confirmed→packed→transit→delivered, or cancelled from an early state. */
export async function advanceOrderStatus(db: Db, orderId: string, to: OrderStatus): Promise<void> {
  const [order] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId));
  if (!order) throw new AdminOrderError(`No order ${orderId}`);
  orderStateMachine.assertTransition(order.status, to);

  await db.transaction(async (tx) => {
    await tx.update(orders).set({ status: to }).where(eq(orders.id, orderId));
    await tx.insert(orderStatusEvents).values({ orderId, status: to });
  });
}
