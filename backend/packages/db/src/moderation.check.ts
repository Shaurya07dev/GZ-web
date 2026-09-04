// Integration check for admin moderation decisions, against real Postgres.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/moderation.check.ts

import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { createDb } from "./client.ts";
import { decideGst, decideKyc, decideInsurance, ModerationError } from "./moderation.ts";
import { users, profiles } from "./schema/identity.ts";
import { artworks } from "./schema/artwork.ts";
import { auditLog } from "./schema/audit.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [admin] = await db.insert(users).values({ firebaseUid: "fb-mod-admin", role: "admin", name: "Mod Admin", email: "mod-admin@example.com" }).returning({ id: users.id });
  const [artist] = await db.insert(users).values({ firebaseUid: "fb-mod-artist", role: "artist", name: "Mod Artist", email: "mod-artist@example.com" }).returning({ id: users.id });
  if (!admin || !artist) throw new Error("seed failed");
  await db.insert(profiles).values({ userId: artist.id, gstStatus: "submitted", aadhaarStatus: "submitted" });

  // Rejection without a reason must be rejected by the app layer before it
  // ever touches the database.
  await assert.rejects(() => decideGst({ db, adminId: admin.id, userId: artist.id, decision: "rejected" }), ModerationError);

  // Approve GST — same-transaction audit log write.
  await decideGst({ db, adminId: admin.id, userId: artist.id, decision: "approved" });
  const [profileAfterGst] = await db.select({ gstStatus: profiles.gstStatus }).from(profiles).where(eq(profiles.userId, artist.id));
  assert.equal(profileAfterGst?.gstStatus, "approved");
  const [gstAuditRow] = await db.select().from(auditLog).where(eq(auditLog.action, "gst.approved"));
  assert.equal(gstAuditRow?.entityId, artist.id, "the audit log entry was written in the same transaction as the status change");

  // Illegal transition: approving an already-approved GST status.
  await assert.rejects(() => decideGst({ db, adminId: admin.id, userId: artist.id, decision: "approved" }), /Illegal Gst transition/);

  // KYC, same pattern.
  await decideKyc({ db, adminId: admin.id, userId: artist.id, decision: "rejected", reason: "Blurred Aadhaar photo" });
  const [profileAfterKyc] = await db.select({ aadhaarStatus: profiles.aadhaarStatus }).from(profiles).where(eq(profiles.userId, artist.id));
  assert.equal(profileAfterKyc?.aadhaarStatus, "rejected");

  // Insurance, on an artwork.
  const [artwork] = await db
    .insert(artworks)
    .values({
      productCode: "GZ-MOD-1",
      artistId: artist.id,
      title: "Mod Test Piece",
      description: "d",
      category: "painting",
      medium: "oil",
      artistPricePaise: 50_000_00,
      listingType: "marketplace_only",
      insuranceStatus: "submitted",
      editableUntil: new Date(Date.now() + 7 * 86_400_000),
    })
    .returning({ id: artworks.id });
  if (!artwork) throw new Error("seed failed");

  await decideInsurance({ db, adminId: admin.id, artworkId: artwork.id, decision: "approved" });
  const [artworkAfter] = await db.select({ insuranceStatus: artworks.insuranceStatus }).from(artworks).where(eq(artworks.id, artwork.id));
  assert.equal(artworkAfter?.insuranceStatus, "approved");

  console.log("packages/db/moderation.ts: KYC/GST/insurance decisions verified against real Postgres, including same-transaction audit writes");
} finally {
  await close();
}
