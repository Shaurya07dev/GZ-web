// Integration check for addresses.ts + admin-settlements.ts, against real Postgres.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/addresses.check.ts

import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { createDb } from "./client.ts";
import { listAddresses, addAddress, updateAddress, deleteAddress, AddressError } from "./addresses.ts";
import { listSettlements, retrySettlement, SettlementError } from "./admin-settlements.ts";
import { users, addresses } from "./schema/identity.ts";
import { settlements } from "./schema/ledger.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [customer] = await db.insert(users).values({ firebaseUid: "fb-addr-customer", role: "customer", name: "Address Test Customer", email: "addr-customer@example.com" }).returning({ id: users.id });
  if (!customer) throw new Error("seed failed");

  assert.equal((await listAddresses(db, customer.id)).length, 0);

  const { id: first } = await addAddress(db, customer.id, { line1: "1 Test St", city: "Bengaluru", state: "KA", pincode: "560001", isDefault: true });
  const { id: second } = await addAddress(db, customer.id, { line1: "2 Test St", city: "Mumbai", state: "MH", pincode: "400001", isDefault: true });

  // Setting the second as default un-defaults the first.
  const afterSecond = await listAddresses(db, customer.id);
  const firstRow = afterSecond.find((a) => a.id === first);
  const secondRow = afterSecond.find((a) => a.id === second);
  assert.equal(firstRow?.isDefault, false, "adding a new default un-defaults the previous one");
  assert.equal(secondRow?.isDefault, true);

  await updateAddress(db, customer.id, first, { isDefault: true });
  const afterUpdate = await db.select().from(addresses).where(eq(addresses.userId, customer.id));
  assert.equal(afterUpdate.find((a) => a.id === first)?.isDefault, true);
  assert.equal(afterUpdate.find((a) => a.id === second)?.isDefault, false, "the update flipped the default back");

  // Cannot touch another user's address.
  await assert.rejects(() => deleteAddress(db, "00000000-0000-0000-0000-000000000000", first), AddressError);

  await deleteAddress(db, customer.id, second);
  assert.equal((await listAddresses(db, customer.id)).length, 1);

  // --- Admin settlements ---------------------------------------------------
  const [artist] = await db.insert(users).values({ firebaseUid: "fb-settle-artist", role: "artist", name: "Settle Artist", email: "settle-artist@example.com" }).returning({ id: users.id });
  if (!artist) throw new Error("seed failed");
  const [settlement] = await db
    .insert(settlements)
    .values({ artistId: artist.id, artistAmountPaise: 1000, platformRevenuePaise: 100, status: "failed", releaseAfter: new Date() })
    .returning({ id: settlements.id });
  if (!settlement) throw new Error("seed failed");

  const listed = await listSettlements(db);
  assert.equal(listed.length, 1);

  await assert.rejects(() => retrySettlement(db, "00000000-0000-0000-0000-000000000000"), SettlementError);

  await retrySettlement(db, settlement.id);
  const [retried] = await db.select({ status: settlements.status }).from(settlements).where(eq(settlements.id, settlement.id));
  assert.equal(retried?.status, "pending");

  // Retrying a non-failed settlement is illegal.
  await assert.rejects(() => retrySettlement(db, settlement.id), /Illegal Settlement transition/);

  console.log("packages/db/addresses.ts + admin-settlements.ts: verified against real Postgres");
} finally {
  await close();
}
