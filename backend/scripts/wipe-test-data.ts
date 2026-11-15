// Nukes all demo/test data from production. We're in the testing phase —
// all the Poster / Test Payment / Test Canvas / GZ Test Customer / GZ Test
// Artist / gz-test-*@example.com rows are leftovers from the pre-launch
// walkthroughs and polluting the admin console. Owner directive 16 Nov 2026:
// "wipe everything dummy. Preserve only orders we explicitly whitelist."
//
// What it DELETES across all collections:
//   * artworks owned by any @example.com / GZ Test artist
//   * orders placed by any @example.com / GZ Test customer
//   * orders whose artwork's title matches the demo titles
//   * cart + wishlist entries under @example.com customers
//   * aggregator holdings + sales under @example.com aggregators
//   * payment docs + statusEvents for the above orders
//   * artworkNfc + pricing + images subcollections for the above artworks
//   * abandonedCartEvents + addresses for the above customers
//
// What it PRESERVES:
//   * auth user records themselves (so the test accounts can still log in
//     to re-test flows cleanly)
//   * users/<uid>, publicProfiles/<uid> for the test accounts
//   * ledger entries + artistSales + settlements (money history is
//     immutable, even in test, so our audit trail stays coherent)
//   * any order whose ID matches the --keep-order whitelist
//
// Usage from backend/:
//   npx tsx scripts/wipe-test-data.ts --dry-run
//   npx tsx scripts/wipe-test-data.ts --i-understand
//   npx tsx scripts/wipe-test-data.ts --i-understand --keep-order=fZSH5H5jc16HmhJOx9p0
//
// Safety rails:
//   * Refuses on emulator project (project id contains "demo-").
//   * --dry-run reports only; without --i-understand it will not write.
//   * Processes in small batches with a yield between to avoid spiking
//     Firestore writes/sec.

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { parseArgs } from "node:util";

interface Args {
  dryRun: boolean;
  confirmed: boolean;
  keepOrderIds: Set<string>;
}

function parse(): Args {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      "i-understand": { type: "boolean", default: false },
      "keep-order": { type: "string", multiple: true },
    },
  });
  return {
    dryRun: Boolean(values["dry-run"]),
    confirmed: Boolean(values["i-understand"]),
    keepOrderIds: new Set(((values["keep-order"] as string[] | undefined) ?? []).filter(Boolean)),
  };
}

function bootstrapFirebase() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    initializeApp({ credential: cert(JSON.parse(raw)) });
    return;
  }
  initializeApp({ credential: applicationDefault() });
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deleteRefs(refs: DocumentReference[], dryRun: boolean): Promise<number> {
  if (dryRun || refs.length === 0) return refs.length;
  const BATCH = 50;
  let deleted = 0;
  for (let i = 0; i < refs.length; i += BATCH) {
    const chunk = refs.slice(i, i + BATCH);
    await Promise.all(chunk.map((r) => r.delete().catch(() => undefined)));
    deleted += chunk.length;
    await sleep(20);
  }
  return deleted;
}

async function listSubcollection(ref: DocumentReference, name: string): Promise<DocumentReference[]> {
  const snap = await ref.collection(name).get();
  return snap.docs.map((d) => d.ref);
}

/** The signatures we use to decide "this is a test account/artwork". */
const DEMO_EMAIL_RE = /@(example\.com|demo\.galleryzone\.in|test\.galleryzone\.in)$/i;
const DEMO_ARTWORK_TITLES = new Set([
  "poster",
  "test payment",
  "test canvas",
  "vighnaharta blessings", // owner flagged this as a test in the UI screenshot
]);

function isDemoEmail(email: string | undefined | null): boolean {
  return Boolean(email && DEMO_EMAIL_RE.test(email.trim()));
}

function isDemoTitle(title: string | undefined | null): boolean {
  return Boolean(title && DEMO_ARTWORK_TITLES.has(title.trim().toLowerCase()));
}

async function main() {
  const args = parse();
  if (!args.dryRun && !args.confirmed) {
    throw new Error("Refusing to proceed without --dry-run or --i-understand.");
  }

  bootstrapFirebase();
  const db = getFirestore();

  // Force the Firestore client to complete initialisation BEFORE we touch
  // anything else. Without this warm-up the next line can throw "Client
  // is not yet ready to issue requests" on some node + google-auth-library
  // version combos (hit on apple@Apples-MacBook-Air-4, 16 Nov 2026).
  await db.collection("users").limit(1).get();

  const projectId = (db as unknown as { projectId?: string }).projectId;
  if (projectId && projectId.startsWith("demo-")) {
    throw new Error(`refusing to run against emulator project ${projectId}`);
  }

  console.log(`\nTarget project: ${projectId ?? "(default)"}`);
  console.log(`Mode: ${args.dryRun ? "DRY-RUN" : args.confirmed ? "WILL DELETE" : "REFUSING"}`);
  console.log(`Keep orders: ${[...args.keepOrderIds].join(", ") || "(none)"}\n`);

  // -------------------------------------------------------------------------
  // Step 1: identify demo users (by email)
  // -------------------------------------------------------------------------
  const usersSnap = await db.collection("users").get();
  const demoUserIds = new Set<string>();
  const nonDemoUserIds = new Set<string>();
  for (const doc of usersSnap.docs) {
    const u = doc.data();
    if (isDemoEmail(u.email as string | undefined)) demoUserIds.add(doc.id);
    else nonDemoUserIds.add(doc.id);
  }
  console.log(`Users: ${demoUserIds.size} demo (@example.com et al) / ${nonDemoUserIds.size} real`);

  // -------------------------------------------------------------------------
  // Step 2: identify demo artworks (by title OR by owner)
  // -------------------------------------------------------------------------
  const artworksSnap = await db.collection("artworks").get();
  const demoArtworkIds = new Set<string>();
  for (const doc of artworksSnap.docs) {
    const a = doc.data();
    if (isDemoTitle(a.title as string | undefined)) demoArtworkIds.add(doc.id);
    if (demoUserIds.has(a.artistId as string)) demoArtworkIds.add(doc.id);
  }
  console.log(`Artworks: ${demoArtworkIds.size} demo / ${artworksSnap.size - demoArtworkIds.size} real`);

  // -------------------------------------------------------------------------
  // Step 3: identify orders to wipe
  // -------------------------------------------------------------------------
  const ordersSnap = await db.collection("orders").get();
  const demoOrderIds = new Set<string>();
  for (const doc of ordersSnap.docs) {
    if (args.keepOrderIds.has(doc.id)) continue;
    const o = doc.data();
    const customerIsDemo = demoUserIds.has(o.customerId as string);
    const artworkIsDemo = demoArtworkIds.has(o.artworkId as string);
    if (customerIsDemo || artworkIsDemo) demoOrderIds.add(doc.id);
  }
  console.log(`Orders: ${demoOrderIds.size} to delete / ${ordersSnap.size - demoOrderIds.size} to keep`);

  // -------------------------------------------------------------------------
  // Step 4: delete orders + their payment + statusEvents
  // -------------------------------------------------------------------------
  let orderCount = 0;
  let paymentCount = 0;
  let orderEventCount = 0;
  for (const orderId of demoOrderIds) {
    const orderRef = db.collection("orders").doc(orderId);
    const statusEvents = await listSubcollection(orderRef, "statusEvents");
    orderEventCount += await deleteRefs(statusEvents, args.dryRun);
    const paySnap = await db.collection("payments").where("orderId", "==", orderId).get();
    paymentCount += await deleteRefs(paySnap.docs.map((d) => d.ref), args.dryRun);
    orderCount += await deleteRefs([orderRef], args.dryRun);
  }
  console.log(`  deleted: orders=${orderCount} payments=${paymentCount} statusEvents=${orderEventCount}`);

  // -------------------------------------------------------------------------
  // Step 5: delete demo artworks + their subcollections + NFC bindings
  // -------------------------------------------------------------------------
  let artworkCount = 0;
  let imgCount = 0;
  let pricingCount = 0;
  let aStatusCount = 0;
  let nfcCount = 0;
  for (const artworkId of demoArtworkIds) {
    const artRef = db.collection("artworks").doc(artworkId);
    const [images, pricing, statusEvents, nfc] = await Promise.all([
      listSubcollection(artRef, "images"),
      listSubcollection(artRef, "pricing"),
      listSubcollection(artRef, "statusEvents"),
      db.collection("artworkNfc").where("artworkId", "==", artworkId).get().then((s) => s.docs.map((d) => d.ref)),
    ]);
    imgCount += await deleteRefs(images, args.dryRun);
    pricingCount += await deleteRefs(pricing, args.dryRun);
    aStatusCount += await deleteRefs(statusEvents, args.dryRun);
    nfcCount += await deleteRefs(nfc, args.dryRun);
    artworkCount += await deleteRefs([artRef], args.dryRun);
  }
  console.log(`  deleted: artworks=${artworkCount} images=${imgCount} pricing=${pricingCount} artworkStatusEvents=${aStatusCount} nfcLinks=${nfcCount}`);

  // -------------------------------------------------------------------------
  // Step 6: wipe ancillary demo data (carts, wishlists, addresses, abandoned)
  // -------------------------------------------------------------------------
  const demoUserRefs: DocumentReference[] = [];
  for (const uid of demoUserIds) {
    demoUserRefs.push(db.collection("carts").doc(uid));
    demoUserRefs.push(db.collection("wishlists").doc(uid));
  }
  let cartAndWishlistCount = 0;
  if (!args.dryRun) {
    for (const ref of demoUserRefs) {
      const snap = await ref.get();
      if (snap.exists) {
        await ref.delete().catch(() => undefined);
        cartAndWishlistCount += 1;
      }
    }
  } else {
    for (const ref of demoUserRefs) {
      const snap = await ref.get();
      if (snap.exists) cartAndWishlistCount += 1;
    }
  }
  console.log(`  cart + wishlist docs: ${cartAndWishlistCount}${args.dryRun ? " (would delete)" : " deleted"}`);

  // Addresses owned by demo users
  const addressSnap = await db.collection("addresses").get();
  const demoAddresses = addressSnap.docs.filter((d) => demoUserIds.has((d.data().userId as string) ?? ""));
  const addrCount = await deleteRefs(demoAddresses.map((d) => d.ref), args.dryRun);
  console.log(`  addresses: ${addrCount}${args.dryRun ? " (would delete)" : " deleted"}`);

  // abandonedCartEvents from demo users
  const abandonSnap = await db.collection("abandonedCartEvents").get().catch(() => null);
  if (abandonSnap) {
    const demoAbandon = abandonSnap.docs.filter((d) => demoUserIds.has((d.data().userId as string) ?? ""));
    const abandonCount = await deleteRefs(demoAbandon.map((d) => d.ref), args.dryRun);
    console.log(`  abandonedCartEvents: ${abandonCount}${args.dryRun ? " (would delete)" : " deleted"}`);
  }

  // Aggregator holdings + sales under demo aggregators
  const holdingsSnap = await db.collection("aggregatorHoldings").get().catch(() => null);
  if (holdingsSnap) {
    const demoHoldings = holdingsSnap.docs.filter((d) => demoUserIds.has((d.data().aggregatorId as string) ?? ""));
    const demoHoldingIds = demoHoldings.map((d) => d.id);
    let salesCount = 0;
    if (demoHoldingIds.length) {
      for (let i = 0; i < demoHoldingIds.length; i += 30) {
        const chunk = demoHoldingIds.slice(i, i + 30);
        const salesSnap = await db.collection("aggregatorSales").where("holdingId", "in", chunk).get();
        salesCount += await deleteRefs(salesSnap.docs.map((d) => d.ref), args.dryRun);
      }
    }
    const holdCount = await deleteRefs(demoHoldings.map((d) => d.ref), args.dryRun);
    console.log(`  aggregator: holdings=${holdCount} sales=${salesCount}`);
  }

  if (args.dryRun) {
    console.log("\n[DRY-RUN] Nothing was actually deleted. Re-run with --i-understand to commit.");
    process.exitCode = 2;
    return;
  }
  if (!args.confirmed) {
    console.log("\n[REFUSED] Add --i-understand to actually delete.");
    process.exitCode = 1;
    return;
  }
  console.log("\n✓ Done. Demo data wiped. Test auth accounts remain so you can re-test flows.");
  console.log("  Next: /admin/orders should now show only real orders.");
  console.log("  Any artist with an incomplete profile will be blocked at submit by the new listing-readiness gate.");
}

main().catch((error) => {
  console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
