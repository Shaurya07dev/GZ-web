// Integration check for deactivation.ts, against real Postgres.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/deactivation.check.ts

import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { createDb } from "./client.ts";
import { requestDeactivation, decideDeactivation, listExternalSaleFees, decideExternalSaleFee, DeactivationError } from "./deactivation.ts";
import { users } from "./schema/identity.ts";
import { artworks, externalSalePenalties } from "./schema/artwork.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [artist] = await db.insert(users).values({ firebaseUid: "fb-deact-artist", role: "artist", name: "Deact Artist", email: "deact-artist@example.com", status: "active" }).returning({ id: users.id });
  const [admin] = await db.insert(users).values({ firebaseUid: "fb-deact-admin", role: "admin", name: "Deact Admin", email: "deact-admin@example.com" }).returning({ id: users.id });
  if (!artist || !admin) throw new Error("seed failed");

  // Deciding with no request yet is refused.
  await assert.rejects(() => decideDeactivation(db, artist.id, admin.id, "approved"), DeactivationError);

  await requestDeactivation(db, artist.id, "Taking a break");
  await assert.rejects(() => requestDeactivation(db, artist.id, "Again"), DeactivationError, "a second request while one is pending is refused");

  await decideDeactivation(db, artist.id, admin.id, "approved", "Confirmed with artist by phone");
  const [suspended] = await db.select({ status: users.status }).from(users).where(eq(users.id, artist.id));
  assert.equal(suspended?.status, "suspended", "approval actually suspends the account");

  // --- External sale fees -----------------------------------------------------
  const [artwork] = await db.insert(artworks).values({ productCode: "GZ-DEACT-1", artistId: artist.id, title: "Deact Test Piece", description: "d", category: "painting", medium: "oil", artistPricePaise: 10_000_00, listingType: "marketplace_only", editableUntil: new Date(Date.now() + 7 * 86_400_000) }).returning({ id: artworks.id });
  if (!artwork) throw new Error("seed failed");
  const [penalty] = await db.insert(externalSalePenalties).values({ artworkId: artwork.id, amountPaise: 1000 }).returning({ id: externalSalePenalties.id });
  if (!penalty) throw new Error("seed failed");

  const fees = await listExternalSaleFees(db);
  assert.equal(fees.length, 1);
  assert.equal(fees[0]?.status, "pending_review");

  await decideExternalSaleFee(db, penalty.id, admin.id, "waived", "First offense");
  const [decided] = await db.select({ status: externalSalePenalties.status }).from(externalSalePenalties).where(eq(externalSalePenalties.id, penalty.id));
  assert.equal(decided?.status, "waived");

  await assert.rejects(() => decideExternalSaleFee(db, penalty.id, admin.id, "approved"), /Illegal ExternalSalePenalty transition/);

  console.log("packages/db/deactivation.ts: verified against real Postgres");
} finally {
  await close();
}
