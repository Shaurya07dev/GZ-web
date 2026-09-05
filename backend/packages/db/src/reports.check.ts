// Integration check for reports.ts, against real Postgres.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/reports.check.ts

import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { DEFAULT_RATE_SEED } from "@galleryzone/domain";
import { createDb } from "./client.ts";
import { setEarningsAbove5L, suggestEarningsAbove5L, generateReport, listReports, ReportError } from "./reports.ts";
import { users, profiles } from "./schema/identity.ts";
import { settlements } from "./schema/ledger.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [artist] = await db.insert(users).values({ firebaseUid: "fb-reports-artist", role: "artist", name: "Reports Artist", email: "reports-artist@example.com" }).returning({ id: users.id });
  if (!artist) throw new Error("seed failed");
  await db.insert(profiles).values({ userId: artist.id, earningsAbove5L: false });

  await assert.rejects(() => setEarningsAbove5L(db, "00000000-0000-0000-0000-000000000000", true), ReportError);

  assert.equal(await suggestEarningsAbove5L(db, artist.id, DEFAULT_RATE_SEED), false, "no settlements yet, well under 5L");

  await db.insert(settlements).values({ artistId: artist.id, artistAmountPaise: DEFAULT_RATE_SEED.earningsAbove5LThresholdPaise, platformRevenuePaise: 0, releaseAfter: new Date() });
  assert.equal(await suggestEarningsAbove5L(db, artist.id, DEFAULT_RATE_SEED), true, "a single settlement at the threshold suggests the flag");

  await setEarningsAbove5L(db, artist.id, true);
  const [profile] = await db.select({ earningsAbove5L: profiles.earningsAbove5L }).from(profiles).where(eq(profiles.userId, artist.id));
  assert.equal(profile?.earningsAbove5L, true);

  const empty = await listReports();
  assert.equal(empty.length, 0);

  const report = await generateReport(db, "sales");
  assert.equal(report.type, "sales");
  assert.equal(report.totalSettledPaise, DEFAULT_RATE_SEED.earningsAbove5LThresholdPaise);

  console.log("packages/db/reports.ts: verified against real Postgres");
} finally {
  await close();
}
