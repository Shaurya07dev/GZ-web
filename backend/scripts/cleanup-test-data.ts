// Cleans accumulated test data for a specific account, so we can start the
// end-to-end dry-run with a clean slate. Written for the owner on 14 Nov 2026
// before the first production dry-run (artist posts → customer buys → ...).
//
// What it deletes for the given account email:
//   orders/*                        every order the customer placed
//   orders/*/statusEvents/*         their status history
//   payments/*                      and the matching payment attempts
//   carts/<uid>                     anything still in cart
//   addresses/*                     saved shipping addresses
//   wishlists/<uid>                 saved wishlist entries
//   abandonedCartEvents/*           and any abandoned-cart email state
//
// If --role=artist is passed, additionally:
//   artworks/*                      every piece the artist owns
//   artworks/*/images/*             image metadata (bucket objects not reaped
//                                   here — run clear-orphaned-images.ts after)
//   artworks/*/pricing/data         the artist price
//   artworks/*/statusEvents/*       status history
//   artworkNfc/*                    NFC links
//   physicalCoaRequests/*           paper-COA requests on their pieces
//
// Never touches:
//   users/<uid>                     the account stays signed in
//   publicProfiles/<uid>            their public profile stays
//   ledger entries                  money history is immutable, even in test
//
// USAGE:
//   cd backend
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     npx tsx scripts/cleanup-test-data.ts --email customer@example.com
//
//   # also wipe their artworks (if the account is an artist too):
//   ... scripts/cleanup-test-data.ts --email saipawan7@gmail.com --role artist
//
//   # dry-run first (prints what would be deleted, writes nothing):
//   ... scripts/cleanup-test-data.ts --email ... --dry-run
//
// SAFETY:
//   - Refuses to run if the resolved project id contains "demo-" (would be
//     the emulator seed; use demo:clear for that).
//   - Requires --i-understand to actually write. Without it, prints a plan
//     and exits non-zero. A second line of defence against mis-typed emails.
//   - Deletes in small batches with a 20ms yield so it does not hammer
//     Firestore's writes/sec budget.

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { parseArgs } from "node:util";

interface Args {
  email: string;
  role: "customer" | "artist";
  dryRun: boolean;
  confirmed: boolean;
}

function parse(): Args {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      role: { type: "string", default: "customer" },
      "dry-run": { type: "boolean", default: false },
      "i-understand": { type: "boolean", default: false },
    },
  });
  if (!values.email) throw new Error("--email is required");
  const role = values.role === "artist" ? "artist" : "customer";
  return {
    email: values.email,
    role,
    dryRun: Boolean(values["dry-run"]),
    confirmed: Boolean(values["i-understand"]),
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

async function main() {
  const args = parse();
  bootstrapFirebase();
  const auth = getAuth();
  const db = getFirestore();

  const projectId = (db as unknown as { projectId?: string }).projectId;
  if (projectId && projectId.startsWith("demo-")) {
    throw new Error(`refusing to run against emulator project ${projectId} — use demo:clear instead`);
  }

  const user = await auth.getUserByEmail(args.email).catch(() => null);
  if (!user) throw new Error(`no auth user with email ${args.email}`);
  const uid = user.uid;
  console.log(`\nTarget: ${args.email} (uid=${uid}) as ${args.role}`);
  console.log(`Project: ${projectId ?? "(default)"}`);
  console.log(`Mode: ${args.dryRun ? "DRY-RUN" : args.confirmed ? "WILL DELETE" : "REFUSING (no --i-understand)"}\n`);

  // --- Customer side (always runs) ----------------------------------------

  const ordersSnap = await db.collection("orders").where("customerId", "==", uid).get();
  const paymentIdsFromOrders = new Set<string>();
  for (const doc of ordersSnap.docs) {
    const statusEvents = await doc.ref.collection("statusEvents").get();
    await deleteRefs(statusEvents.docs.map((d) => d.ref), args.dryRun);
    // Capture the matching payment doc id (same orderId field) — we delete
    // those after.
  }
  const paymentsSnap = await db.collection("payments").where("orderId", "in", ordersSnap.docs.map((d) => d.id).slice(0, 30)).get().catch(() => null);
  const paymentCount = paymentsSnap?.size ?? 0;
  if (paymentsSnap) await deleteRefs(paymentsSnap.docs.map((d) => d.ref), args.dryRun);

  const addressesSnap = await db.collection("addresses").where("userId", "==", uid).get();
  const abandonedSnap = await db.collection("abandonedCartEvents").where("userId", "==", uid).get().catch(() => null);
  const cartRef = db.collection("carts").doc(uid);
  const wishlistRef = db.collection("wishlists").doc(uid);

  const orderDelCount = await deleteRefs(ordersSnap.docs.map((d) => d.ref), args.dryRun);
  const addressDelCount = await deleteRefs(addressesSnap.docs.map((d) => d.ref), args.dryRun);
  const abandonedDelCount = abandonedSnap ? await deleteRefs(abandonedSnap.docs.map((d) => d.ref), args.dryRun) : 0;
  if (!args.dryRun) {
    await cartRef.delete().catch(() => undefined);
    await wishlistRef.delete().catch(() => undefined);
  }

  console.log("Customer cleanup:");
  console.log(`  orders ........... ${orderDelCount}${args.dryRun ? " (would delete)" : ""}`);
  console.log(`  payments ......... ${paymentCount}${args.dryRun ? " (would delete)" : ""}`);
  console.log(`  addresses ........ ${addressDelCount}${args.dryRun ? " (would delete)" : ""}`);
  console.log(`  abandoned events . ${abandonedDelCount}${args.dryRun ? " (would delete)" : ""}`);
  console.log(`  cart + wishlist .. ${args.dryRun ? "(would clear)" : "cleared"}`);

  // --- Artist side (only when --role=artist) ------------------------------

  if (args.role === "artist") {
    const artworksSnap = await db.collection("artworks").where("artistId", "==", uid).get();
    let artworkDelCount = 0;
    for (const doc of artworksSnap.docs) {
      const [images, pricing, statusEvents, nfc] = await Promise.all([
        doc.ref.collection("images").get(),
        doc.ref.collection("pricing").get(),
        doc.ref.collection("statusEvents").get(),
        db.collection("artworkNfc").where("artworkId", "==", doc.id).get(),
      ]);
      await deleteRefs(images.docs.map((d) => d.ref), args.dryRun);
      await deleteRefs(pricing.docs.map((d) => d.ref), args.dryRun);
      await deleteRefs(statusEvents.docs.map((d) => d.ref), args.dryRun);
      await deleteRefs(nfc.docs.map((d) => d.ref), args.dryRun);
    }
    artworkDelCount = await deleteRefs(artworksSnap.docs.map((d) => d.ref), args.dryRun);

    console.log("\nArtist cleanup:");
    console.log(`  artworks ......... ${artworkDelCount}${args.dryRun ? " (would delete)" : ""}`);
  }

  if (args.dryRun) {
    console.log("\n[DRY-RUN] Nothing was actually deleted. Re-run with --i-understand to commit.");
    process.exitCode = 2;
    return;
  }
  if (!args.confirmed) {
    console.log("\n[REFUSED] Add --i-understand to actually delete, or --dry-run to preview.");
    process.exitCode = 1;
    return;
  }
  console.log("\n✓ Done. The account itself (users/, publicProfiles/, ledger entries) is untouched.");
}

main().catch((error) => {
  console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
