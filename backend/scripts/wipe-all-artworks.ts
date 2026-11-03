// Deletes every artwork and everything that references one.
//
// Why this exists (3 Nov 2026): the production project went live with
// GalleryZone's URL still serving a survey form. Every COA, QR code and
// NFC tag that was baked against www.galleryzone.art during that window
// pointed at the survey, not the app. Nothing in production is real yet
// — all the pieces are demo seed data from before go-live — so we wipe
// them and let artists re-upload against the correct Vercel URL now set
// in PUBLIC_SITE_URL.
//
// What it deletes:
//   artworks/*                             the piece itself
//   artworks/*/images/*                    image metadata (bucket objects
//                                          not touched here; use
//                                          clear-orphaned-images afterwards
//                                          to reap them)
//   artworks/*/pricing/data                the private artist price
//   artworks/*/statusEvents/*              the status history
//   artworkNfc/*                           the chip → artwork link, so a
//                                          re-upload isn't flagged "already
//                                          linked" if the chip is reused
//   externalSalePenalties/* for artworks   stale penalties on gone pieces
//   physicalCoaRequests/* for artworks     paper-COA requests on gone pieces
//   carts/*  entries pointing at gone      so the mobile cart doesn't show
//     artworks are filtered out              broken rows
//
// What it leaves alone:
//   users/*, publicProfiles/*              every account stays
//   orders/*                               payment history is immutable;
//                                          we don't rewrite money. (In
//                                          practice there are none yet.)
//   aggregator holdings/sales              same reason
//   invoiceCounters                        same reason
//
// Hard safety rails:
//   1. --dry-run reports only. No --dry-run writes nothing until --yes is
//      passed alongside.
//   2. The project must match `expected` (second arg) or the script
//      refuses. Mis-pointing at a different project is the easy mistake
//      and it costs real data.
//   3. If any order exists on a piece, the piece is skipped and listed:
//      a paid order means the piece is real and someone bought it.
//
// Usage, from backend/:
//   npm run wipe:artworks -- --dry-run --project=galleryzone-prod
//   npm run wipe:artworks -- --yes --project=galleryzone-prod

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const confirmed = args.includes("--yes");
const projectArg = args.find((a) => a.startsWith("--project="))?.split("=")[1];

if (!dryRun && !confirmed) {
  throw new Error("Refusing to proceed without --dry-run or --yes.");
}
if (!projectArg) {
  throw new Error("Pass --project=<FIREBASE_PROJECT_ID> so there's no doubt which project is being wiped.");
}

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
if (!projectId) throw new Error("FIREBASE_PROJECT_ID is not set.");
if (projectId !== projectArg) {
  throw new Error(
    `Refusing: FIREBASE_PROJECT_ID is "${projectId}" but --project=${projectArg} was passed. ` +
      "Make them agree so there is no doubt which project this writes to.",
  );
}

const configured = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "";
const keyFile = [configured, resolve(root, "apps", "api", configured), resolve(root, configured)]
  .filter(Boolean)
  .find((c) => existsSync(c));
const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!keyFile && !inlineJson) {
  throw new Error("No Firebase credential. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON.");
}
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(inlineJson ?? readFileSync(keyFile!, "utf8")) as Record<string, string>;
  initializeApp({ credential: cert(serviceAccount), projectId });
}
const db = getFirestore();

console.log(`\n${dryRun ? "DRY RUN — " : ""}Project: ${projectId}\n`);

// 1. Collect every artwork id, and work out which ones are safe to delete.
const artworksSnap = await db.collection("artworks").get();
const allIds = artworksSnap.docs.map((d) => d.id);
console.log(`Found ${allIds.length} artwork${allIds.length === 1 ? "" : "s"}.`);

// 2. Any order against the piece means someone paid for it — leave it.
const protectedIds = new Set<string>();
if (allIds.length > 0) {
  // `in` caps at 30. Chunk and union.
  for (let i = 0; i < allIds.length; i += 30) {
    const chunk = allIds.slice(i, i + 30);
    const ordersSnap = await db.collection("orders").where("artworkId", "in", chunk).get();
    for (const o of ordersSnap.docs) {
      const data = o.data() as { artworkId?: string };
      if (data.artworkId) protectedIds.add(data.artworkId);
    }
  }
}
if (protectedIds.size > 0) {
  console.log(`Keeping ${protectedIds.size} artwork${protectedIds.size === 1 ? "" : "s"} with existing orders:`);
  for (const id of protectedIds) console.log(`  · ${id}`);
}

const toDelete = allIds.filter((id) => !protectedIds.has(id));
console.log(`Will delete ${toDelete.length} artwork${toDelete.length === 1 ? "" : "s"}.`);
if (toDelete.length === 0) {
  console.log("Nothing to delete. Exiting.");
  process.exit(0);
}

// 3. For each artwork delete every subcollection, then the doc itself.
let totalSub = 0;
async function deleteCollection(path: string): Promise<number> {
  const snap = await db.collection(path).get();
  if (snap.empty) return 0;
  if (!dryRun) {
    // Firestore batches cap at 500 writes.
    for (let i = 0; i < snap.docs.length; i += 500) {
      const batch = db.batch();
      snap.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  return snap.size;
}

for (const id of toDelete) {
  totalSub += await deleteCollection(`artworks/${id}/images`);
  totalSub += await deleteCollection(`artworks/${id}/pricing`);
  totalSub += await deleteCollection(`artworks/${id}/statusEvents`);
  totalSub += await deleteCollection(`artworks/${id}/ownershipEvents`);
}
console.log(`${dryRun ? "Would delete" : "Deleted"} ${totalSub} subcollection docs.`);

// 4. artworkNfc is keyed by chip UID, with a pointer back to the artwork.
//    Clear the pointer so the chip reads blank on next check — if a chip is
//    rewritten to a new piece, we don't want "already linked" to point at a
//    piece that no longer exists.
const nfcSnap = await db.collection("artworkNfc").get();
let nfcCleared = 0;
if (!nfcSnap.empty) {
  const toClear = nfcSnap.docs.filter((d) => {
    const data = d.data() as { artworkId?: string };
    return data.artworkId && !protectedIds.has(data.artworkId);
  });
  nfcCleared = toClear.length;
  if (!dryRun && toClear.length > 0) {
    for (let i = 0; i < toClear.length; i += 500) {
      const batch = db.batch();
      toClear.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}
console.log(`${dryRun ? "Would delete" : "Deleted"} ${nfcCleared} NFC chip links.`);

// 5. externalSalePenalties on gone pieces — stale, no reason to keep.
const penaltiesSnap = await db.collection("externalSalePenalties").get();
let penaltiesCleared = 0;
if (!penaltiesSnap.empty) {
  const toClear = penaltiesSnap.docs.filter((d) => {
    const data = d.data() as { artworkId?: string };
    return data.artworkId && !protectedIds.has(data.artworkId);
  });
  penaltiesCleared = toClear.length;
  if (!dryRun && toClear.length > 0) {
    for (let i = 0; i < toClear.length; i += 500) {
      const batch = db.batch();
      toClear.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}
console.log(`${dryRun ? "Would delete" : "Deleted"} ${penaltiesCleared} external-sale penalties.`);

// 6. physicalCoaRequests on gone pieces.
const coaSnap = await db.collection("physicalCoaRequests").get();
let coaCleared = 0;
if (!coaSnap.empty) {
  const toClear = coaSnap.docs.filter((d) => {
    const data = d.data() as { artworkId?: string };
    return data.artworkId && !protectedIds.has(data.artworkId);
  });
  coaCleared = toClear.length;
  if (!dryRun && toClear.length > 0) {
    for (let i = 0; i < toClear.length; i += 500) {
      const batch = db.batch();
      toClear.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}
console.log(`${dryRun ? "Would delete" : "Deleted"} ${coaCleared} paper-COA requests.`);

// 7. Cart entries pointing at gone artworks — filter them out of each cart.
const cartsSnap = await db.collection("carts").get();
let cartsTouched = 0;
let entriesDropped = 0;
if (!cartsSnap.empty) {
  const gone = new Set(toDelete);
  for (const cart of cartsSnap.docs) {
    const data = cart.data() as { entries?: { artworkId: string }[]; userId?: string };
    const entries = data.entries ?? [];
    const kept = entries.filter((e) => !gone.has(e.artworkId));
    if (kept.length !== entries.length) {
      cartsTouched++;
      entriesDropped += entries.length - kept.length;
      if (!dryRun) {
        await cart.ref.update({ entries: kept });
      }
    }
  }
}
console.log(
  `${dryRun ? "Would touch" : "Touched"} ${cartsTouched} cart${cartsTouched === 1 ? "" : "s"} (${entriesDropped} entries dropped).`,
);

// 8. The artworks themselves.
if (!dryRun) {
  for (let i = 0; i < toDelete.length; i += 500) {
    const batch = db.batch();
    toDelete.slice(i, i + 500).forEach((id) => batch.delete(db.collection("artworks").doc(id)));
    await batch.commit();
  }
}
console.log(`${dryRun ? "Would delete" : "Deleted"} ${toDelete.length} artwork${toDelete.length === 1 ? "" : "s"}.\n`);

console.log(dryRun ? "DRY RUN complete. Re-run with --yes to apply." : "Done.");
console.log(
  "\nFollow-up: run `npm run clear:orphaned-images` to reap the image objects in the storage bucket.",
);
