// Integration check for PostgresRateConfigStore — run against a real
// Postgres, not mocked. Needs the same throwaway container
// scripts/test-migrations.sh uses; run via:
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/postgres/rate-config-store.check.ts
//
// Exercises the exact same scenarios as in-memory/rate-config-store.check.ts
// (unapproved proposals never leak, self-approval is rejected, versioning
// respects effectiveFrom) so both implementations of RateConfigStore are
// proven to behave identically — the whole point of them sharing an
// interface.

import assert from "node:assert/strict";
import { loadActiveRates } from "@galleryzone/config";
import { DEFAULT_RATE_SEED } from "@galleryzone/domain";
import { createDb } from "../client.ts";
import { PostgresRateConfigStore } from "./rate-config-store.ts";
import { users } from "../schema/identity.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check (see scripts/test-migrations.sh)");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [admin1] = await db
    .insert(users)
    .values({ firebaseUid: "fb-admin-1", role: "admin", name: "Admin One", email: "admin1@example.com" })
    .returning({ id: users.id });
  const [admin2] = await db
    .insert(users)
    .values({ firebaseUid: "fb-admin-2", role: "admin", name: "Admin Two", email: "admin2@example.com" })
    .returning({ id: users.id });
  if (!admin1 || !admin2) throw new Error("failed to seed admin users");

  const store = new PostgresRateConfigStore(db);

  // Unapproved proposal never leaks.
  const higherGst = { ...DEFAULT_RATE_SEED, gstRate: 0.12 };
  await store.propose({ rates: higherGst, effectiveFrom: new Date("2020-01-01"), proposedBy: admin1.id, reason: "integration test: unapproved" });
  const stillSeed = await loadActiveRates(store, new Date("2030-01-01"));
  assert.deepEqual(stillSeed, DEFAULT_RATE_SEED, "an unapproved proposal must not be read");

  // Self-approval rejected.
  const selfProposeId = await store.propose({ rates: DEFAULT_RATE_SEED, effectiveFrom: new Date("2026-01-01"), proposedBy: admin1.id, reason: "integration test: self-approve" });
  await assert.rejects(() => store.approve({ versionId: selfProposeId, approvedBy: admin1.id }), /self-approved/);

  // Two-step propose -> approve -> becomes active as of effectiveFrom.
  const v1Id = await store.propose({ rates: { ...DEFAULT_RATE_SEED, gstRate: 0.05 }, effectiveFrom: new Date("2026-02-01"), proposedBy: admin1.id, reason: "integration test: v1" });
  await store.approve({ versionId: v1Id, approvedBy: admin2.id });

  const beforeEffective = await loadActiveRates(store, new Date("2026-01-31"));
  assert.deepEqual(beforeEffective, DEFAULT_RATE_SEED, "before effectiveFrom, the old rate applies");

  const afterEffective = await loadActiveRates(store, new Date("2026-02-01"));
  assert.equal(afterEffective.gstRate, 0.05);

  const v2Id = await store.propose({ rates: { ...DEFAULT_RATE_SEED, gstRate: 0.12 }, effectiveFrom: new Date("2026-06-01"), proposedBy: admin1.id, reason: "integration test: v2" });
  await store.approve({ versionId: v2Id, approvedBy: admin2.id });

  const marchOrder = await loadActiveRates(store, new Date("2026-03-15"));
  assert.equal(marchOrder.gstRate, 0.05, "a transaction settled in March replays against v1 forever");

  const julyOrder = await loadActiveRates(store, new Date("2026-07-15"));
  assert.equal(julyOrder.gstRate, 0.12, "a transaction settled in July reads v2");

  console.log("packages/db/postgres/rate-config-store.ts: all propose/approve/versioning checks passed against real Postgres");
} finally {
  await close();
}
