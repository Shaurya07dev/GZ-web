// Integration check for the full checkout flow — createOrder() ->
// confirmSimulatedPayment() — against real Postgres. Proves the whole
// chain: artwork price -> active rate version -> order/payment rows ->
// balanced ledger postings -> order status transition, all through actual
// tables and the actual DB trigger, not mocks.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/checkout.check.ts

import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { DEFAULT_RATE_SEED, displayPriceOf } from "@galleryzone/domain";
import { createDb } from "./client.ts";
import { createOrder, confirmSimulatedPayment, CheckoutError } from "./checkout.ts";
import { PostgresRateConfigStore } from "./postgres/rate-config-store.ts";
import { users, addresses } from "./schema/identity.ts";
import { artworks } from "./schema/artwork.ts";
import { orders, payments } from "./schema/order.ts";
import { ledgerEntries } from "./schema/ledger.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  // Checkout with NO approved rate version yet must fail clearly, not
  // silently fall back to a seed the order can't legally reference.
  const [earlyArtist] = await db
    .insert(users)
    .values({ firebaseUid: "fb-checkout-artist-0", role: "artist", name: "Pre-Rate Artist", email: "pre-rate@example.com" })
    .returning({ id: users.id });
  const [earlyCustomer] = await db
    .insert(users)
    .values({ firebaseUid: "fb-checkout-customer-0", role: "customer", name: "Early Customer", email: "early-customer@example.com" })
    .returning({ id: users.id });
  if (!earlyArtist || !earlyCustomer) throw new Error("seed failed");
  const [earlyAddress] = await db
    .insert(addresses)
    .values({ userId: earlyCustomer.id, line1: "1 Test St", city: "Bengaluru", state: "KA", pincode: "560001" })
    .returning({ id: addresses.id });
  const [earlyArtwork] = await db
    .insert(artworks)
    .values({
      productCode: "GZ-TEST-0",
      artistId: earlyArtist.id,
      title: "Pre-Rate Piece",
      description: "d",
      category: "painting",
      medium: "oil",
      artistPricePaise: 10_000_00,
      listingType: "marketplace_only",
      editableUntil: new Date(Date.now() + 7 * 86_400_000),
    })
    .returning({ id: artworks.id });
  if (!earlyAddress || !earlyArtwork) throw new Error("seed failed");

  await assert.rejects(
    () => createOrder({ db, customerId: earlyCustomer.id, artworkId: earlyArtwork.id, addressId: earlyAddress.id, idempotencyKey: "idem-no-rate" }),
    CheckoutError,
    "checkout without an approved rate version must fail, not silently proceed",
  );

  // Seed an approved rate version (the propose/approve flow, exercised
  // directly rather than via HTTP since that's gated by RolesGuard).
  const rateStore = new PostgresRateConfigStore(db);
  const proposerId = earlyArtist.id; // any user id works for this test — RBAC on WHO can propose is an app-layer concern, not this store's
  const approverId = earlyCustomer.id;
  const versionId = await rateStore.propose({ rates: DEFAULT_RATE_SEED, effectiveFrom: new Date("2020-01-01"), proposedBy: proposerId, reason: "checkout.check.ts seed" });
  await rateStore.approve({ versionId, approvedBy: approverId });

  // Now the full flow.
  const [artist] = await db
    .insert(users)
    .values({ firebaseUid: "fb-checkout-artist-1", role: "artist", name: "Checkout Test Artist", email: "checkout-artist@example.com" })
    .returning({ id: users.id });
  const [customer] = await db
    .insert(users)
    .values({ firebaseUid: "fb-checkout-customer-1", role: "customer", name: "Checkout Test Customer", email: "checkout-customer@example.com" })
    .returning({ id: users.id });
  if (!artist || !customer) throw new Error("seed failed");
  const [address] = await db
    .insert(addresses)
    .values({ userId: customer.id, line1: "2 Test St", city: "Bengaluru", state: "KA", pincode: "560001" })
    .returning({ id: addresses.id });
  const artistPricePaise = 100_000_00; // ₹1,00,000
  const [artwork] = await db
    .insert(artworks)
    .values({
      productCode: "GZ-TEST-1",
      artistId: artist.id,
      title: "Checkout Test Piece",
      description: "d",
      category: "painting",
      medium: "oil",
      artistPricePaise,
      listingType: "marketplace_only",
      editableUntil: new Date(Date.now() + 7 * 86_400_000),
    })
    .returning({ id: artworks.id });
  if (!address || !artwork) throw new Error("seed failed");

  const { orderId, totalPaise } = await createOrder({
    db,
    customerId: customer.id,
    artworkId: artwork.id,
    addressId: address.id,
    idempotencyKey: "idem-checkout-1",
  });

  const expectedDisplay = displayPriceOf(artistPricePaise, DEFAULT_RATE_SEED);
  assert.equal(totalPaise, expectedDisplay + DEFAULT_RATE_SEED.deliveryCharge, "checkout total matches the pricing engine's own math");

  const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId));
  assert.equal(orderRow?.status, "pending");

  const [paymentRow] = await db.select().from(payments).where(eq(payments.orderId, orderId));
  assert.equal(paymentRow?.status, "pending");
  assert.equal(paymentRow?.method, "simulated");

  const { transactionId } = await confirmSimulatedPayment(db, orderId);

  const [paidOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
  assert.equal(paidOrder?.status, "paid", "order transitioned pending -> paid");

  const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.transactionId, transactionId));
  assert.ok(entries.length > 0, "ledger entries were posted for this checkout");
  const sum = entries.reduce((total, e) => total + e.amountPaise, 0);
  assert.equal(sum, 0, "the posted ledger entries balance to zero in the real database");

  // Confirming an already-paid order again must be rejected by the state
  // machine, not silently double-post the ledger.
  await assert.rejects(() => confirmSimulatedPayment(db, orderId), /Illegal Order transition/);

  console.log("packages/db/checkout.ts: full createOrder -> confirmSimulatedPayment flow verified against real Postgres");
} finally {
  await close();
}
