// Integration check for artist artwork submission + the real moderation
// gate, against real Postgres.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/artist-artworks.check.ts

import assert from "node:assert/strict";
import { eq, desc } from "drizzle-orm";
import { DEFAULT_RATE_SEED } from "@galleryzone/domain";
import { createDb } from "./client.ts";
import { submitArtwork, approveArtwork, rejectArtwork, countArtistArtworks, ArtistArtworkError } from "./artist-artworks.ts";
import { users } from "./schema/identity.ts";
import { artworkStatusEvents } from "./schema/artwork.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [artist] = await db.insert(users).values({ firebaseUid: "fb-submit-artist", role: "artist", name: "Submit Test Artist", email: "submit-artist@example.com" }).returning({ id: users.id });
  if (!artist) throw new Error("seed failed");

  assert.equal(await countArtistArtworks(db, artist.id), 0);

  const { artworkId, productCode } = await submitArtwork({
    db,
    artistId: artist.id,
    title: "Submission Test Piece",
    description: "d",
    category: "painting",
    medium: "oil",
    artistPricePaise: 75_000_00,
    listingType: "marketplace_only",
    rates: DEFAULT_RATE_SEED,
  });
  assert.match(productCode, /^GZ\d{6}$/);
  assert.equal(await countArtistArtworks(db, artist.id), 1);

  // A new submission is unranked/unlisted — the real moderation gate the
  // mock frontend was missing: it starts pending_approval, NOT marketplace.
  const [firstEvent] = await db.select().from(artworkStatusEvents).where(eq(artworkStatusEvents.artworkId, artworkId));
  assert.equal(firstEvent?.status, "pending_approval", "a new submission is never auto-approved");

  // Admin approves — pending_approval -> marketplace.
  await approveArtwork(db, artworkId);
  const [latest] = await db.select().from(artworkStatusEvents).where(eq(artworkStatusEvents.artworkId, artworkId)).orderBy(desc(artworkStatusEvents.changedAt)).limit(1);
  assert.equal(latest?.status, "marketplace");

  // Approving again is illegal (marketplace -> marketplace is not a listed transition).
  await assert.rejects(() => approveArtwork(db, artworkId), /Illegal Artwork transition/);

  // A second submission, rejected instead.
  const second = await submitArtwork({
    db,
    artistId: artist.id,
    title: "Second Test Piece",
    description: "d",
    category: "sculpture",
    medium: "bronze",
    artistPricePaise: 40_000_00,
    listingType: "marketplace_only",
    rates: DEFAULT_RATE_SEED,
  });
  await assert.rejects(() => rejectArtwork(db, second.artworkId, ""), ArtistArtworkError, "rejection without a reason is refused");
  await rejectArtwork(db, second.artworkId, "Image quality too low for the marketplace");
  const [secondLatest] = await db.select().from(artworkStatusEvents).where(eq(artworkStatusEvents.artworkId, second.artworkId)).orderBy(desc(artworkStatusEvents.changedAt)).limit(1);
  assert.equal(secondLatest?.status, "returned");
  assert.equal(secondLatest?.reason, "Image quality too low for the marketplace");

  assert.equal(await countArtistArtworks(db, artist.id), 2, "both submissions count, regardless of moderation outcome");

  console.log("packages/db/artist-artworks.ts: submission + real moderation gate verified against real Postgres");
} finally {
  await close();
}
