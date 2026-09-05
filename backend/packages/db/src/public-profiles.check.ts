// Integration check for public-profiles.ts, against real Postgres.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/public-profiles.check.ts

import assert from "node:assert/strict";
import { DEFAULT_RATE_SEED } from "@galleryzone/domain";
import { createDb } from "./client.ts";
import { getPublicArtistProfile, listUsers, setUserStatus, ProfileError } from "./public-profiles.ts";
import { submitArtwork } from "./artist-artworks.ts";
import { users, profiles } from "./schema/identity.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [artist] = await db.insert(users).values({ firebaseUid: "fb-profile-artist", role: "artist", name: "Profile Test Artist", email: "profile-artist@example.com" }).returning({ id: users.id });
  const [customer] = await db.insert(users).values({ firebaseUid: "fb-profile-customer", role: "customer", name: "Profile Test Customer", email: "profile-customer@example.com" }).returning({ id: users.id });
  if (!artist || !customer) throw new Error("seed failed");
  await db.insert(profiles).values({ userId: artist.id, headline: "Contemporary painter", bio: "Loves oils.", location: "Udaipur" });

  await submitArtwork({ db, artistId: artist.id, title: "Profile Test Piece", description: "d", category: "painting", medium: "oil", artistPricePaise: 20_000_00, listingType: "marketplace_only", rates: DEFAULT_RATE_SEED });

  const profile = await getPublicArtistProfile(db, artist.id);
  assert.equal(profile.headline, "Contemporary painter");
  assert.equal(profile.artworkCount, 1);
  // artistPricePaise must never appear on this shape at all — verified
  // structurally: the type doesn't have the field, and this assertion
  // confirms the runtime object doesn't either.
  assert.ok(!("artistPricePaise" in profile), "public profile never carries the artist's price");

  await assert.rejects(() => getPublicArtistProfile(db, "00000000-0000-0000-0000-000000000000"), ProfileError);

  const artists = await listUsers(db, "artist");
  assert.equal(artists.length, 1);
  assert.equal(artists[0]?.id, artist.id);

  const allUsers = await listUsers(db);
  assert.equal(allUsers.length, 2);

  await setUserStatus(db, customer.id, "suspended");
  const [suspended] = await listUsers(db, "customer");
  assert.equal(suspended?.status, "suspended");

  console.log("packages/db/public-profiles.ts: verified against real Postgres");
} finally {
  await close();
}
