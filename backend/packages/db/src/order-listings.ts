// Order listing reads — customer's own order history and the artist's
// dashboard "My Artworks" list. Both are plain filtered selects; the
// interesting logic (checkout, payment, ledger) lives in checkout.ts.

import { desc, eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { orders } from "./schema/order.ts";
import { artworks } from "./schema/artwork.ts";

export async function listCustomerOrders(db: Db, customerId: string) {
  return db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt));
}

export async function getOrder(db: Db, orderId: string) {
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
  return row ?? null;
}

export async function listArtistArtworks(db: Db, artistId: string) {
  return db.select().from(artworks).where(eq(artworks.artistId, artistId)).orderBy(desc(artworks.createdAt));
}
