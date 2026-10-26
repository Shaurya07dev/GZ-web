// Backfill the public artist projection introduced with real social links and
// public verification tiers.
//
//   npm run backfill:public-artists                 # dry run
//   npm run backfill:public-artists -- --apply      # write staging/production
//
// Instagram remains private: it only contributes the tier-1 boolean. The
// public document receives the portfolio website and optional process-video
// URL, plus booleans derived from the current MOU and recorded sales.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Collections,
  CURRENT_MOU_VERSION,
  createDb,
  mouAcceptancesCol,
  userProfileCol,
  type ProfileDoc,
  type PublicProfileDoc,
  type UserDoc,
} from "../packages/db/src/index.ts";

const root = resolve(import.meta.dirname, "..");

function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && process.env[match[1]!] === undefined) {
      process.env[match[1]!] = match[2]!.replace(/^"|"$/g, "");
    }
  }
}

loadDotEnv(resolve(root, "..", ".env"));
loadDotEnv(resolve(root, "apps", "api", ".env"));

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error("FIREBASE_PROJECT_ID is not set");
const apply = process.argv.includes("--apply");
const { db } = createDb(projectId);

console.log(`${apply ? "APPLYING to" : "dry run against"} project ${projectId}`);
const artists = await db.collection(Collections.users).where("role", "==", "artist").get();
const writes: { uid: string; patch: Partial<PublicProfileDoc> }[] = [];

for (const artist of artists.docs) {
  const user = artist.data() as UserDoc;
  const [profileSnap, mouSnap, saleSnap] = await Promise.all([
    db.collection(userProfileCol(artist.id)).doc("data").get(),
    db.collection(mouAcceptancesCol(artist.id)).doc(CURRENT_MOU_VERSION.artist).get(),
    db.collection(Collections.artistSales).where("artistId", "==", artist.id).limit(1).get(),
  ]);
  const profile = profileSnap.data() as ProfileDoc | undefined;
  const patch: Partial<PublicProfileDoc> = {
    name: user.name,
    headline: profile?.headline ?? null,
    bio: profile?.bio ?? null,
    location: profile?.location ?? null,
    profileImageUrl: profile?.profileImageUrl ?? null,
    website: profile?.website ?? null,
    socialProofVideoUrl: profile?.socialProofVideoUrl ?? null,
    tier1SocialMedia: Boolean(profile?.instagram || profile?.website),
    tier2ArtistAgreement: mouSnap.exists,
    tier3FirstSale: !saleSnap.empty,
  };
  writes.push({ uid: artist.id, patch });
  console.log(
    `${artist.id}: website=${Boolean(patch.website)} video=${Boolean(patch.socialProofVideoUrl)} ` +
      `tiers=${Number(patch.tier1SocialMedia)}${Number(patch.tier2ArtistAgreement)}${Number(patch.tier3FirstSale)}`,
  );
}

console.log(`${writes.length} artist public profiles would be updated`);
if (!apply) {
  console.log("dry run only: nothing was written. Re-run with --apply after reviewing the target project.");
  process.exit(0);
}

for (let i = 0; i < writes.length; i += 400) {
  const batch = db.batch();
  for (const { uid, patch } of writes.slice(i, i + 400)) {
    batch.set(db.collection(Collections.publicProfiles).doc(uid), patch, { merge: true });
  }
  await batch.commit();
  console.log(`wrote ${Math.min(i + 400, writes.length)} / ${writes.length}`);
}

console.log("public artist profile backfill complete");
