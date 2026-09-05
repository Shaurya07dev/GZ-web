// Integration check for order-listings.ts, against real Postgres.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/order-listings.check.ts

import assert from "node:assert/strict";
import { DEFAULT_RATE_SEED } from "@galleryzone/domain";
import { createDb } from "./client.ts";
import { createOrder } from "./checkout.ts";
import { submitArtwork } from "./artist-artworks.ts";
import { listCustomerOrders, getOrder, listArtistArtworks } from "./order-listings.ts";
import { PostgresRateConfigStore } from "./postgres/rate-config-store.ts";
import { users, addresses } from "./schema/identity.ts";
import { artworks } from "./schema/artwork.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [artist] = await db.insert(users).values({ firebaseUid: "fb-orderlist-artist", role: "artist", name: "Orderlist Artist", email: "orderlist-artist@example.com" }).returning({ id: users.id });
  const [customer] = await db.insert(users).values({ firebaseUid: "fb-orderlist-customer", role: "customer", name: "Orderlist Customer", email: "orderlist-customer@example.com" }).returning({ id: users.id });
  const [approver] = await db.insert(users).values({ firebaseUid: "fb-orderlist-approver", role: "admin", name: "Orderlist Approver", email: "orderlist-approver@example.com" }).returning({ id: users.id });
  if (!artist || !customer || !approver) throw new Error("seed failed");

  await submitArtwork({ db, artistId: artist.id, title: "Orderlist Piece 1", description: "d", category: "painting", medium: "oil", artistPricePaise: 10_000_00, listingType: "marketplace_only", rates: DEFAULT_RATE_SEED });
  await submitArtwork({ db, artistId: artist.id, title: "Orderlist Piece 2", description: "d", category: "painting", medium: "oil", artistPricePaise: 20_000_00, listingType: "marketplace_only", rates: DEFAULT_RATE_SEED });

  const artistArtworks = await listArtistArtworks(db, artist.id);
  assert.equal(artistArtworks.length, 2);
  assert.ok(artistArtworks.every((a) => typeof a.artistPricePaise === "number"), "the artist's own listing legitimately includes their price");

  const [address] = await db.insert(addresses).values({ userId: customer.id, line1: "1 Test St", city: "Bengaluru", state: "KA", pincode: "560001" }).returning({ id: addresses.id });
  const [artwork] = await db.select({ id: artworks.id }).from(artworks).limit(1);
  if (!address || !artwork) throw new Error("seed failed");

  const rateStore = new PostgresRateConfigStore(db);
  const versionId = await rateStore.propose({ rates: DEFAULT_RATE_SEED, effectiveFrom: new Date("2020-01-01"), proposedBy: artist.id, reason: "order-listings.check.ts seed" });
  await rateStore.approve({ versionId, approvedBy: approver.id });

  assert.equal((await listCustomerOrders(db, customer.id)).length, 0);

  const { orderId } = await createOrder({ db, customerId: customer.id, artworkId: artwork.id, addressId: address.id, idempotencyKey: "idem-orderlist-1" });

  const customerOrders = await listCustomerOrders(db, customer.id);
  assert.equal(customerOrders.length, 1);
  assert.equal(customerOrders[0]?.id, orderId);

  const fetched = await getOrder(db, orderId);
  assert.equal(fetched?.status, "pending");

  assert.equal(await getOrder(db, "00000000-0000-0000-0000-000000000000"), null);

  console.log("packages/db/order-listings.ts: verified against real Postgres");
} finally {
  await close();
}
