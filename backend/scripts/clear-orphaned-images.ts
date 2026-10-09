// Removes artwork image metadata whose object no longer exists in the bucket.
//
// Why this exists: the images lived in a Railway bucket on an account whose
// trial ended, and the bucket could not be exported before it went away. The
// Firestore metadata survived, so every one of those artworks now advertises
// an image URL that 404s — and the URL is denormalised in TWO places, the
// image doc itself and the listing projection's coverImageUrl, so deleting the
// doc alone would leave the marketplace still pointing at a dead file.
//
// What it does, per artwork: HEAD each image's object in the bucket, delete the
// metadata docs whose object is missing, then rebuild the listing projection so
// coverImageUrl/coverThumbnailUrl/imageCount follow. Artworks then fall back to
// the placeholder and the artist can re-upload.
//
// It deletes nothing it has not first confirmed missing. An image whose object
// is still present is left completely alone, so this is safe to run against a
// healthy bucket — it simply finds nothing to do.
//
//   npm run clear:orphaned-images -- --dry-run   # report only
//   npm run clear:orphaned-images                # apply
//
// Idempotent: a second run finds nothing.

import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dryRun = process.argv.includes("--dry-run");

function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, "").trim();
  }
}

const root = resolve(import.meta.dirname, "..");
loadDotEnv(resolve(root, "..", ".env"));
loadDotEnv(resolve(root, "apps", "api", ".env"));

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error("FIREBASE_PROJECT_ID is not set (see .env.example)");

const configured = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "";
const keyFile = [configured, resolve(root, "apps", "api", configured), resolve(root, configured)].filter(Boolean).find((c) => existsSync(c));
const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!keyFile && !inlineJson) {
  throw new Error(`No Firebase credential. Set GOOGLE_APPLICATION_CREDENTIALS to the key file, or FIREBASE_SERVICE_ACCOUNT_JSON inline.`);
}
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(inlineJson ?? readFileSync(keyFile!, "utf8")) as Record<string, string>;
  initializeApp({ credential: cert(serviceAccount), projectId });
}
const db = getFirestore();

// The bucket is optional: with no credentials every object reads as missing,
// which would delete everything. So refuse rather than guess.
const { S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION } = process.env;
if (!S3_BUCKET || !S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
  throw new Error(
    "S3_* is not fully set. This script decides what to delete by asking the bucket, so without credentials it " +
      "cannot tell a missing object from an unreachable one — and deleting on that basis would destroy live metadata.",
  );
}
const s3 = new S3Client({
  region: S3_REGION || "auto",
  endpoint: S3_ENDPOINT,
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
});

/** "missing" only for a definite 404/NotFound. Anything else is unknown and must NOT be treated as missing. */
async function objectState(key: string): Promise<"present" | "missing" | "unknown"> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return "present";
  } catch (error) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return "missing";
    return "unknown";
  }
}

const artworks = await db.collection("artworks").get();
let present = 0;
let unknown = 0;
const orphans: { artworkId: string; title: string; imageId: string; key: string }[] = [];

for (const doc of artworks.docs) {
  const images = await doc.ref.collection("images").get();
  if (images.empty) continue;
  const title = (doc.data() as { title?: string }).title ?? "(untitled)";
  for (const image of images.docs) {
    const key = (image.data() as { storagePath?: string }).storagePath;
    if (!key) {
      // No object key at all — nothing to check, and nothing to serve either.
      orphans.push({ artworkId: doc.id, title, imageId: image.id, key: "(no storagePath)" });
      continue;
    }
    const state = await objectState(key);
    if (state === "present") present++;
    else if (state === "unknown") {
      unknown++;
      console.log(`  ? ${title}: could not determine state of ${key} — left alone`);
    } else orphans.push({ artworkId: doc.id, title, imageId: image.id, key });
  }
}

console.log(`\nimages still in the bucket : ${present}`);
console.log(`images confirmed missing   : ${orphans.length}`);
if (unknown) console.log(`indeterminate (untouched)  : ${unknown}`);

if (orphans.length === 0) {
  console.log("nothing to clear");
  process.exit(0);
}

for (const o of orphans) console.log(`  - ${o.title} (${o.artworkId}) -> ${o.key}`);

if (dryRun) {
  console.log("\ndry run — nothing written");
  process.exit(0);
}

// Delete the metadata, then rebuild each affected artwork's listing projection
// so the marketplace stops advertising the dead cover.
const { refreshListing } = await import("../packages/db/src/listing-projection.ts");
const touched = new Set<string>();
for (const o of orphans) {
  await db.collection("artworks").doc(o.artworkId).collection("images").doc(o.imageId).delete();
  touched.add(o.artworkId);
}
console.log(`\ndeleted ${orphans.length} image doc(s)`);

for (const artworkId of touched) {
  await refreshListing(db, artworkId);
}
console.log(`rebuilt ${touched.size} listing projection(s) — covers now fall back to the placeholder`);
