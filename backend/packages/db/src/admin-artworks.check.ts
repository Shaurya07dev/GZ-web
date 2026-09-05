// Integration check for admin-artworks.ts, against real Postgres.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/admin-artworks.check.ts

import assert from "node:assert/strict";
import { DEFAULT_RATE_SEED } from "@galleryzone/domain";
import { createDb } from "./client.ts";
import { submitArtwork, approveArtwork } from "./artist-artworks.ts";
import { listAllArtworksAdmin, setArtworkRarity, delistArtwork, getAuditLog, AdminArtworkError } from "./admin-artworks.ts";
import { users } from "./schema/identity.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [artist] = await db.insert(users).values({ firebaseUid: "fb-admin-art-artist", role: "artist", name: "Admin Art Artist", email: "admin-art-artist@example.com" }).returning({ id: users.id });
  const [admin] = await db.insert(users).values({ firebaseUid: "fb-admin-art-admin", role: "admin", name: "Admin Art Admin", email: "admin-art-admin@example.com" }).returning({ id: users.id });
  if (!artist || !admin) throw new Error("seed failed");

  const { artworkId } = await submitArtwork({ db, artistId: artist.id, title: "Admin Artworks Test Piece", description: "d", category: "painting", medium: "oil", artistPricePaise: 60_000_00, listingType: "marketplace_only", rates: DEFAULT_RATE_SEED });

  const rows = await listAllArtworksAdmin(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, "pending_approval");
  assert.equal(rows[0]?.artistPricePaise, 60_000_00, "the admin view legitimately includes artistPricePaise");
  assert.equal(rows[0]?.rarityType, null);

  await setArtworkRarity(db, artworkId, "R", admin.id);
  const afterRarity = await listAllArtworksAdmin(db);
  assert.equal(afterRarity[0]?.rarityType, "R");

  await assert.rejects(() => setArtworkRarity(db, artworkId, "X" as never, admin.id), AdminArtworkError);

  await approveArtwork(db, artworkId);
  const afterApproval = await listAllArtworksAdmin(db);
  assert.equal(afterApproval[0]?.status, "marketplace");

  await delistArtwork(db, artworkId, admin.id);
  const afterDelist = await listAllArtworksAdmin(db);
  assert.equal(afterDelist[0]?.status, "returned");

  // Delisting an already-returned piece is illegal.
  await assert.rejects(() => delistArtwork(db, artworkId, admin.id), /Illegal Artwork transition/);

  const audit = await getAuditLog(db);
  const actions = audit.map((a) => a.action);
  assert.ok(actions.includes("artwork.rarity_set"));
  assert.ok(actions.includes("artwork.delisted"));

  console.log("packages/db/admin-artworks.ts: verified against real Postgres");
} finally {
  await close();
}
