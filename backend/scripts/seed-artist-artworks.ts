// One-shot: creates N approved + live artworks under a specific artist.
// Written for the owner on 9 Nov 2026 to seed Sai Pawan's account with
// demo pieces around ₹100-120 for a live-site walkthrough.
//
// Why direct admin-SDK writes instead of hitting the API: the submit
// endpoint now enforces listing-readiness (PAN + approved Aadhaar +
// pickup address + bank + per-piece weight). Owner wanted the pieces
// up now; the script bypasses those guards and writes the same shape
// the handlers would write. Each piece ends up status=marketplace
// (approved + live) so it is buyable immediately.
//
// USAGE:
//   cd backend
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     npx tsx scripts/seed-artist-artworks.ts \
//     --email saipawan7@gmail.com --count 3 --price 110
//
// Or set FIREBASE_SERVICE_ACCOUNT_JSON to the raw JSON contents
// (what Railway holds). Both work.
//
// SAFETY:
//   - Refuses to run if the resolved project id contains "demo-".
//   - Refuses if the user exists but is not an artist.
//   - Each piece is given a unique title with a timestamp suffix so
//     re-running the script makes new pieces, never overwrites.

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { parseArgs } from "node:util";
import {
  approveArtwork,
  Collections,
  FirestoreRateConfigStore,
  refreshListing,
  setArtworkRarity,
  submitArtwork,
  type UserDoc,
} from "../packages/db/src/index.ts";
import { loadActiveRates } from "../packages/config/src/rate-config.ts";

interface Args {
  email: string;
  count: number;
  price: number;
}

function parse(): Args {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      count: { type: "string", default: "3" },
      price: { type: "string", default: "110" },
    },
  });
  if (!values.email) throw new Error("--email is required");
  return {
    email: values.email,
    count: Math.max(1, Math.min(20, Number(values.count))),
    price: Math.max(1, Number(values.price)),
  };
}

function bootstrapFirebase() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    initializeApp({ credential: cert(JSON.parse(raw)) });
    return;
  }
  // GOOGLE_APPLICATION_CREDENTIALS path, or ADC on a logged-in gcloud.
  initializeApp({ credential: applicationDefault() });
}

async function main() {
  const args = parse();
  bootstrapFirebase();
  const auth = getAuth();
  const db = getFirestore();

  // Safety: refuse against a demo project (demo-* is what the emulator
  // uses). We want the real one here — mistake protection goes the
  // other direction compared to the demo seeder.
  const project = (db as unknown as { _settings?: { projectId?: string } })._settings?.projectId
    ?? process.env.GOOGLE_CLOUD_PROJECT
    ?? "(unknown)";
  if (project.startsWith("demo-")) throw new Error(`Refusing to run against ${project} — point at production`);

  // Resolve the artist's uid from their email.
  const user = await auth.getUserByEmail(args.email);
  const userSnap = await db.collection(Collections.users).doc(user.uid).get();
  const userDoc = userSnap.data() as UserDoc | undefined;
  if (!userDoc) throw new Error(`No users/${user.uid} doc for ${args.email}`);
  if (userDoc.role !== "artist") throw new Error(`User ${args.email} is a ${userDoc.role}, not an artist`);

  const rateStore = new FirestoreRateConfigStore(db);
  const rates = await loadActiveRates(rateStore);

  console.log(`Seeding ${args.count} piece(s) for ${args.email} (${user.uid}) at ₹${args.price}…`);

  for (let i = 1; i <= args.count; i++) {
    const stamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
    const title = `Demo Piece ${i} · ${stamp}`;
    const result = await submitArtwork({
      db,
      artistId: user.uid,
      title,
      description: `A sample ${i} of ${args.count} seeded for GalleryZone QA. Price around ₹${args.price}.`,
      category: "Painting",
      medium: "Acrylic on canvas",
      artistPricePaise: Math.round(args.price * 100),
      listingType: "marketplace_only",
      dimensions: "30 x 40 cm",
      yearCreated: new Date().getFullYear(),
      mode: "review",
      artworkType: "Modern",
      paintingStyle: "Abstract",
      physical: {
        weightKg: 1.5,
        framing: "Unframed",
        format: "Canvas",
        hangingHardwareIncluded: true,
        packagingConfirmed: true,
      },
      exclusive: false,
      rates,
    });
    // Approve it straight through — the admin's normal moderation path,
    // minus the human. Writes the status event + audit log entry the
    // same way admin's own click does. "approved by" shows the artist's
    // own uid in the audit log; swap for a real admin id if you want it
    // to read cleanly.
    await approveArtwork(db, result.artworkId, user.uid);
    await setArtworkRarity(db, result.artworkId, "standard", user.uid);
    await refreshListing(db, result.artworkId, rates);
    console.log(`  ✓ ${title}  →  ${result.productCode}  (${result.artworkId})`);
  }
  console.log("Done.");
}

main().catch((error) => {
  console.error("seed-artist-artworks failed:", error);
  process.exit(1);
});
