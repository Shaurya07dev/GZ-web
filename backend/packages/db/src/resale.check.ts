// Integration check for admin-orders.ts, gallery-spaces.ts, messaging.ts,
// resale.ts, against real Postgres.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/resale.check.ts

import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { DEFAULT_RATE_SEED } from "@galleryzone/domain";
import { createDb } from "./client.ts";
import { createOrder } from "./checkout.ts";
import { advanceOrderStatus, getAddressAdmin, AdminOrderError } from "./admin-orders.ts";
import { listGallerySpaces, addGallerySpace } from "./gallery-spaces.ts";
import { listMessages, markMessageRead, listSupportTickets, submitSupportTicket, MessagingError } from "./messaging.ts";
import { listMyResaleListings, createResaleListing, withdrawResaleListing, completeResaleSale, ResaleError } from "./resale.ts";
import { PostgresRateConfigStore } from "./postgres/rate-config-store.ts";
import { users, addresses } from "./schema/identity.ts";
import { artworks } from "./schema/artwork.ts";
import { messageThreads } from "./schema/community.ts";
import { ledgerEntries } from "./schema/ledger.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [artist] = await db.insert(users).values({ firebaseUid: "fb-misc-artist", role: "artist", name: "Misc Artist", email: "misc-artist@example.com" }).returning({ id: users.id });
  const [customer] = await db.insert(users).values({ firebaseUid: "fb-misc-customer", role: "customer", name: "Misc Customer", email: "misc-customer@example.com" }).returning({ id: users.id });
  const [aggregator] = await db.insert(users).values({ firebaseUid: "fb-misc-aggregator", role: "aggregator", name: "Misc Aggregator", email: "misc-aggregator@example.com" }).returning({ id: users.id });
  const [approver] = await db.insert(users).values({ firebaseUid: "fb-misc-approver", role: "admin", name: "Misc Approver", email: "misc-approver@example.com" }).returning({ id: users.id });
  if (!artist || !customer || !aggregator || !approver) throw new Error("seed failed");

  // --- Admin orders -----------------------------------------------------------
  const [address] = await db.insert(addresses).values({ userId: customer.id, line1: "1 Test St", city: "Bengaluru", state: "KA", pincode: "560001" }).returning({ id: addresses.id });
  const [artwork] = await db.insert(artworks).values({ productCode: "GZ-MISC-1", artistId: artist.id, title: "Misc Piece", description: "d", category: "painting", medium: "oil", artistPricePaise: 30_000_00, listingType: "marketplace_only", editableUntil: new Date(Date.now() + 7 * 86_400_000) }).returning({ id: artworks.id });
  if (!address || !artwork) throw new Error("seed failed");

  const rateStore = new PostgresRateConfigStore(db);
  const versionId = await rateStore.propose({ rates: DEFAULT_RATE_SEED, effectiveFrom: new Date("2020-01-01"), proposedBy: artist.id, reason: "resale.check.ts seed" });
  await rateStore.approve({ versionId, approvedBy: approver.id });

  const { orderId } = await createOrder({ db, customerId: customer.id, artworkId: artwork.id, addressId: address.id, idempotencyKey: "idem-misc-1" });

  await assert.rejects(() => advanceOrderStatus(db, orderId, "packed"), /Illegal Order transition/, "cannot skip straight to packed from pending");
  await advanceOrderStatus(db, orderId, "paid");
  await advanceOrderStatus(db, orderId, "confirmed");
  await advanceOrderStatus(db, orderId, "packed");
  await advanceOrderStatus(db, orderId, "transit");
  await advanceOrderStatus(db, orderId, "delivered");
  await assert.rejects(() => advanceOrderStatus(db, orderId, "cancelled"), /Illegal Order transition/, "delivered is terminal");
  await assert.rejects(() => advanceOrderStatus(db, "00000000-0000-0000-0000-000000000000", "paid"), AdminOrderError);

  const fetchedAddress = await getAddressAdmin(db, address.id);
  assert.equal(fetchedAddress?.city, "Bengaluru");

  // --- Gallery spaces -----------------------------------------------------------
  assert.equal((await listGallerySpaces(db, aggregator.id)).length, 0);
  await addGallerySpace(db, aggregator.id, { name: "Udaipur Gallery", addressLine1: "MG Road", city: "Udaipur", state: "RJ", pincode: "313001" });
  assert.equal((await listGallerySpaces(db, aggregator.id)).length, 1);

  // --- Messaging + support -------------------------------------------------------
  const [thread] = await db.insert(messageThreads).values({ userId: artist.id, fromLabel: "GalleryZone Team", subject: "Welcome", preview: "p", body: "b" }).returning({ id: messageThreads.id });
  if (!thread) throw new Error("seed failed");
  assert.equal((await listMessages(db, artist.id))[0]?.unread, true);
  await markMessageRead(db, artist.id, thread.id);
  assert.equal((await listMessages(db, artist.id))[0]?.unread, false);
  await assert.rejects(() => markMessageRead(db, customer.id, thread.id), MessagingError, "cannot mark another user's thread read");

  assert.equal((await listSupportTickets(db, artist.id)).length, 0);
  await submitSupportTicket(db, artist.id, "Help", "Something's wrong");
  assert.equal((await listSupportTickets(db, artist.id)).length, 1);

  // --- Resale -----------------------------------------------------------------
  const { id: listingId } = await createResaleListing(db, customer.id, artwork.id, 25_000_00);
  assert.equal((await listMyResaleListings(db, customer.id)).length, 1);

  const { transactionId } = await completeResaleSale(db, customer.id, listingId);
  const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.transactionId, transactionId));
  const sum = entries.reduce((total, e) => total + e.amountPaise, 0);
  assert.equal(sum, 0, "resale sale postings balance to zero");

  await assert.rejects(() => completeResaleSale(db, customer.id, listingId), /Illegal ResaleListing transition/, "cannot complete an already-sold listing");

  const { id: secondListingId } = await createResaleListing(db, customer.id, artwork.id, 20_000_00);
  await withdrawResaleListing(db, customer.id, secondListingId);
  await assert.rejects(() => withdrawResaleListing(db, customer.id, secondListingId), /Illegal ResaleListing transition/);
  await assert.rejects(() => withdrawResaleListing(db, artist.id, secondListingId), ResaleError, "cannot withdraw another seller's listing");

  console.log("packages/db/admin-orders.ts + gallery-spaces.ts + messaging.ts + resale.ts: verified against real Postgres");
} finally {
  await close();
}
