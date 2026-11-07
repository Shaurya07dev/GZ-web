// Demo data for the whole product, for local end-to-end testing (web + mobile share this API).
//
//   npm run demo:seed     # fills the emulator (refuses if it is already seeded)
//   npm run demo:reseed   # clear, then seed
//   npm run demo:clear    # wipes ALL emulator data + auth users: back to a fresh, empty install
//
// SAFETY: this only ever talks to the local emulators. It refuses to run unless
// FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST are set and the project id
// starts with "demo-", so it cannot touch production. "Revert" is the emulator wipe
// (clear), which is exact because the emulator holds nothing but what you put there.
//
// HOW: the data is made by calling the same backend functions the API calls (submit,
// approve, reserve, checkout, sale, withdrawal, transfer...), so the ledger, settlements,
// ownership history, listing projections and NFC state are the real thing, not look-alikes.
// Only dates are then moved back in time (an aggregator "day 26 of 30" needs a holding
// that was created 26 days ago); every such edit is marked `backdate(...)` below.
//
// Logins (all accounts): password Demo@12345
//   admin@demo.galleryzone.in, artistN@..., aggregatorN@..., customerN@...  (see PEOPLE)
//
// DEMO_IMAGE_BASE: artwork photos are the files in frontend-web/public/artworks. They are stored
// as relative URLs (/artworks/x.png) for the website. For the Flutter app on an Android emulator
// run with DEMO_IMAGE_BASE=http://10.0.2.2:3000 so the phone can fetch them from the web server.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { getAuth } from "firebase-admin/auth";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { DEFAULT_RATE_SEED, type PricingRates } from "../packages/domain/src/index.ts";
import * as db_ from "../packages/db/src/index.ts";

const {
  createDb, Collections, artworkImagesCol, userProfileCol, artworkStatusEventsCol, artworkOwnershipEventsCol,
  submitArtwork, approveArtwork, rejectArtwork, setArtworkRarity, markSoldElsewhere, refreshListing,
  createWalletTopup, markTopupPaid, reserveHolding, recordAggregatorSale, requestHoldingExtension, decideHoldingExtension,
  returnHolding, advanceShipment, markRemitted, addAddress, createOrder, confirmSimulatedPayment, advanceOrderStatus,
  linkNfcTag, lockNfcTag, requestWithdrawal, approveWithdrawal, rejectWithdrawal, initiateTransfer, acceptTransfer,
  cancelTransfer, createResaleListing, withdrawResaleListing, completeResaleSale, addToCart, submitBlog, acceptBlog,
  rejectBlog, createHoldingReport, resolveHoldingReport, submitSupportTicket, requestDeactivation, decideExternalSaleFee,
  seedAffiliateProducts, mouAcceptancesCol, CURRENT_MOU_VERSION,
} = db_;

const here = dirname(fileURLToPath(import.meta.url));
const PASSWORD = "Demo@12345";
const DOMAIN = "demo.galleryzone.in";
const IMAGE_BASE = process.env.DEMO_IMAGE_BASE ?? "";
const rs = (rupees: number) => Math.round(rupees * 100);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const ts = (d: Date) => Timestamp.fromDate(d);

// --- Guard + clear --------------------------------------------------------------
// Always the local emulators (ports from firebase.demo.json), never a real project.
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8180";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
const fsHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-gz";
if (!projectId.startsWith("demo-")) {
  console.error(`Refusing to run: FIREBASE_PROJECT_ID is "${projectId}". This seeds the LOCAL emulators only and needs a demo-* project id (or none, which means demo-gz).`);
  process.exit(1);
}

async function clearAll(): Promise<void> {
  const a = await fetch(`http://${fsHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  const b = await fetch(`http://${authHost}/emulator/v1/projects/${projectId}/accounts`, { method: "DELETE" });
  if (!a.ok || !b.ok) throw new Error(`clear failed: firestore ${a.status}, auth ${b.status}`);
  console.log("emulator wiped: all documents and auth users removed");
}

const mode = process.argv[2] ?? "seed";
if (mode === "clear") {
  await clearAll();
  process.exit(0);
}

const { db } = createDb(projectId);
const auth = getAuth();
if (mode === "reseed") await clearAll();
else if (!(await db.collection(Collections.users).limit(1).get()).empty) {
  console.error("The emulator already has data. Run `npm run demo:reseed` to start over (or `npm run demo:clear` to empty it).");
  process.exit(1);
}

const rates: PricingRates = DEFAULT_RATE_SEED;
let step = 0;
const say = (m: string) => console.log(`[${String(++step).padStart(2, "0")}] ${m}`);
/** Moves a stored date back in time. The only place the seed bypasses the backend functions. */
const backdate = (ref: FirebaseFirestore.DocumentReference, patch: Record<string, Date>) =>
  ref.update(Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, ts(v)])));

// --- Rates (needs an approved version before any money moves) -----------------------
await db.collection(Collections.rateConfigVersions).doc("demo-v1").set({
  rates, effectiveFrom: ts(new Date("2026-01-01")), proposedBy: "demo-admin", proposedAt: ts(new Date("2026-01-01")),
  approvedBy: "demo-admin-2", approvedAt: ts(new Date("2026-01-01")), approved: true, reason: "Demo seed: launch rates",
});

// --- People -------------------------------------------------------------------------
type Kyc = "approved" | "submitted" | "rejected" | "not_submitted";
interface Person { key: string; role: "artist" | "aggregator" | "customer" | "admin"; name: string; city: string; state: string; pin: string; kyc?: Kyc; gst?: Kyc; headline?: string; external?: boolean; status?: "active" | "pending" | "suspended" }

const PEOPLE: Person[] = [
  { key: "admin", role: "admin", name: "Aarav Mehta (Admin)", city: "Mumbai", state: "Maharashtra", pin: "400001" },
  // Ten artists, one per tradition, at different stages of verification.
  { key: "artist1", role: "artist", name: "Sunita Devi", city: "Madhubani", state: "Bihar", pin: "847211", kyc: "approved", gst: "approved", headline: "Madhubani painter, third generation" },
  { key: "artist2", role: "artist", name: "Ramesh Wayeda", city: "Dahanu", state: "Maharashtra", pin: "401601", kyc: "approved", gst: "not_submitted", headline: "Warli storyteller" },
  { key: "artist3", role: "artist", name: "Dilip Shyam", city: "Bhopal", state: "Madhya Pradesh", pin: "462001", kyc: "approved", gst: "approved", headline: "Gond art, Patangarh lineage" },
  { key: "artist4", role: "artist", name: "Lakshmi Narayana", city: "Srikalahasti", state: "Andhra Pradesh", pin: "517644", kyc: "approved", gst: "submitted", headline: "Kalamkari pen-work master" },
  { key: "artist5", role: "artist", name: "Anjali Raghunathan", city: "Thanjavur", state: "Tamil Nadu", pin: "613001", kyc: "approved", gst: "approved", headline: "Tanjore paintings in gold leaf" },
  { key: "artist6", role: "artist", name: "Prakash Joshi", city: "Bhilwara", state: "Rajasthan", pin: "311001", kyc: "approved", gst: "not_submitted", headline: "Phad scroll painter", external: true },
  { key: "artist7", role: "artist", name: "Mitali Das", city: "Puri", state: "Odisha", pin: "752001", kyc: "submitted", gst: "not_submitted", headline: "Pattachitra from Raghurajpur" },
  { key: "artist8", role: "artist", name: "Farhan Qureshi", city: "Kolkata", state: "West Bengal", pin: "700001", kyc: "rejected", gst: "rejected", headline: "Contemporary abstract, acrylics" },
  { key: "artist9", role: "artist", name: "Neha Kulkarni", city: "Pune", state: "Maharashtra", pin: "411001", kyc: "not_submitted", gst: "not_submitted", headline: "New on GalleryZone" },
  { key: "artist10", role: "artist", name: "Tenzin Dorjee", city: "Gangtok", state: "Sikkim", pin: "737101", kyc: "approved", gst: "approved", headline: "Thangka and mineral pigments", status: "pending" },
  // Five aggregators (galleries), each at a different point of the 30-day placement.
  { key: "aggregator1", role: "aggregator", name: "Kala Ghar Gallery", city: "Mumbai", state: "Maharashtra", pin: "400050", kyc: "approved", gst: "approved" },
  { key: "aggregator2", role: "aggregator", name: "Rangmanch Art House", city: "New Delhi", state: "Delhi", pin: "110001", kyc: "approved", gst: "approved" },
  { key: "aggregator3", role: "aggregator", name: "Jaipur Canvas Co.", city: "Jaipur", state: "Rajasthan", pin: "302001", kyc: "approved", gst: "approved" },
  { key: "aggregator4", role: "aggregator", name: "Bengal Atelier", city: "Kolkata", state: "West Bengal", pin: "700019", kyc: "approved", gst: "approved" },
  { key: "aggregator5", role: "aggregator", name: "Southern Strokes", city: "Bengaluru", state: "Karnataka", pin: "560001", kyc: "submitted", gst: "approved" },
  // Collectors.
  { key: "customer1", role: "customer", name: "Ishaan Kapoor", city: "Gurugram", state: "Haryana", pin: "122001" },
  { key: "customer2", role: "customer", name: "Priya Nair", city: "Kochi", state: "Kerala", pin: "682001" },
  { key: "customer3", role: "customer", name: "Vikram Singh", city: "Chandigarh", state: "Chandigarh", pin: "160017" },
  { key: "customer4", role: "customer", name: "Ananya Rao", city: "Hyderabad", state: "Telangana", pin: "500001" },
  { key: "customer5", role: "customer", name: "Rohan Bhatt", city: "Ahmedabad", state: "Gujarat", pin: "380001" },
  { key: "customer6", role: "customer", name: "Meera Iyer", city: "Chennai", state: "Tamil Nadu", pin: "600001" },
];


// A small hand-signed-looking PNG (no image library needed): the artist's MOU signature is what the
// certificate prints above "Artist Signature", so every signed artist needs one.
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b: Buffer) => { let c = ~0; for (const x of b) c = CRC[(c ^ x) & 255]! ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
function signaturePng(seed: number): string {
  const W = 320, H = 110, px = Buffer.alloc(W * H * 4);
  for (let t = 0; t < 1; t += 0.0006) {
    const x = 10 + t * (W - 20), y = H / 2 + Math.sin(t * (9 + (seed % 5)) * Math.PI) * (22 + (seed % 3) * 6) * (1 - t * 0.5) + Math.sin(t * 40) * 4;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const X = Math.round(x + dx), Y = Math.round(y + dy);
      if (X >= 0 && X < W && Y >= 0 && Y < H) { const o = (Y * W + X) * 4; px[o] = 20; px[o + 1] = 24; px[o + 2] = 60; px[o + 3] = 255; }
    }
  }
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return "data:image/png;base64," + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]).toString("base64");
}

const uid = (key: string) => `demo-${key}`;
const emailOf = (key: string) => `${key}@${DOMAIN}`;
const nameOf = (key: string) => PEOPLE.find((p) => p.key === key)!.name;
const GRANTS = ["platform_admin", "finance_admin", "moderation_admin"];

say("people: auth accounts, user docs, profiles");
for (const [i, p] of PEOPLE.entries()) {
  const id = uid(p.key);
  const grants = p.role === "admin" ? GRANTS : [];
  await auth.createUser({ uid: id, email: emailOf(p.key), password: PASSWORD, displayName: p.name, emailVerified: true });
  await auth.setCustomUserClaims(id, { role: p.role, grants });
  await db.collection(Collections.users).doc(id).set({
    firebaseUid: id, role: p.role, status: p.status ?? "active", name: p.name, email: emailOf(p.key),
    phone: `+91 98${String(10000000 + i * 137).padStart(8, "0")}`, createdAt: ts(daysAgo(120 - i * 3)), lastLoginAt: ts(daysAgo(i % 5)),
    roleGrants: grants, ...(p.external ? { externalArtist: true } : {}),
  });
  const kyc = p.kyc ?? "not_submitted";
  const gst = p.gst ?? "not_submitted";
  await db.collection(userProfileCol(id)).doc("data").set({
    bio: p.role === "artist" ? `${p.name} works in ${p.city}, ${p.state}. ${p.headline}.` : null, profileImageUrl: null,
    headline: p.headline ?? null, location: `${p.city}, ${p.state}`, instagram: p.role === "artist" ? `@${p.key}.art` : null, website: null,
    pan: kyc === "not_submitted" ? null : `ABCDE${1000 + i}F`, gstin: gst === "not_submitted" ? null : `27ABCDE${1000 + i}F1Z5`,
    gstStatus: gst, aadhaarStatus: kyc, aadhaarMasked: kyc === "not_submitted" ? null : `XXXX XXXX ${1000 + i}`,
    ...(kyc === "rejected" ? { aadhaarReviewNote: "Name on the document does not match the profile.", gstReviewNote: "GSTIN not found in the registry." } : {}),
    bankAccountMasked: kyc === "approved" ? `XXXXXX${2000 + i}` : null, ifsc: kyc === "approved" ? "HDFC0000123" : null,
    pickupLine1: p.role === "customer" || p.role === "admin" ? null : `${10 + i}, Art Lane`, pickupLine2: null, pickupCity: p.city, pickupState: p.state, pickupPincode: p.pin, pickupCountry: "IN",
    earningsAbove5L: false, socialProofVideoUrl: null, companyName: p.role === "aggregator" ? p.name : null,
    galleryzoneRating: p.role === "artist" && kyc === "approved" ? 6 + (i % 4) : null,
  });
  if (p.role === "artist") {
    await db.collection(Collections.publicProfiles).doc(id).set({
      name: p.name, headline: p.headline ?? null, bio: `${p.name} works in ${p.city}, ${p.state}.`, location: `${p.city}, ${p.state}`, profileImageUrl: null,
      website: null, socialProofVideoUrl: null, tier1SocialMedia: kyc !== "not_submitted", tier2ArtistAgreement: kyc === "approved", tier3FirstSale: false,
    });
  }
}


say("MOUs: signed by artists with approved KYC and aggregators 1-4 (aggregator 5 and artists 7-9 stay unsigned to test the gate)");
for (const [i, p] of PEOPLE.entries()) {
  const signs = (p.role === "artist" && p.kyc === "approved") || ["aggregator1", "aggregator2", "aggregator3", "aggregator4"].includes(p.key);
  if (!signs) continue;
  const party = p.role as "artist" | "aggregator";
  await db.collection(mouAcceptancesCol(uid(p.key))).doc(CURRENT_MOU_VERSION[party]).set({ party, version: CURRENT_MOU_VERSION[party], signatureName: p.name, signatureDataUrl: signaturePng(i), acceptedAt: ts(daysAgo(100 - i)) });
}

say("categories, rate config, gallery spaces");
for (const [slug, name] of [["painting", "Painting"], ["printmaking", "Printmaking"], ["mixed-media", "Mixed Media"], ["textile", "Textile Art"], ["ceramics", "Ceramics"]] as const) {
  await db.collection(Collections.categories).doc(slug).set({ name, slug });
}
for (const k of ["aggregator1", "aggregator2", "aggregator3", "aggregator4", "aggregator5"]) {
  const p = PEOPLE.find((x) => x.key === k)!;
  await db.collection(Collections.gallerySpaces).add({ aggregatorId: uid(k), name: `${p.name} - Main hall`, addressLine1: "12 Gallery Road", city: p.city, state: p.state, pincode: p.pin, capacity: 40, coordinatorName: "Front desk" });
}

// --- Artworks: 55 pieces, each ending in a different state --------------
const IMAGES = ["bird.png", "collage-busts.png", "draped-figure.png", "eye-pyramid.png", "framed-painting.png", "hero-original-art.png", "landscape.png", "portrait-woman.png"];
const imageUrl = (f: string) => `${IMAGE_BASE}/artworks/${f}`;

type End = "draft" | "review" | "rejected" | "live" | "external";
interface Piece { cat?: string; id: string; artist: string; title: string; type: string; medium: string; dims: string; year: number; price: number; listing: "marketplace_only" | "aggregator_only" | "marketplace_and_aggregator"; rank: "R" | "U" | "O" | "S" | "G" | null; legacy?: boolean; end: End; ageDays: number; nfc?: "unlocked" | "locked" }
const T = {
  madhubani: "Bihar: Madhubani (Mithila) Painting", warli: "Maharashtra: Warli Art", gond: "Madhya Pradesh: Gond Art", kalamkari: "Andhra Pradesh: Kalamkari",
  tanjore: "Tamil Nadu: Tanjore Painting", phad: "Rajasthan: Phad Painting", pattachitra: "Odisha: Pattachitra", thangka: "Arunachal Pradesh: Thangka", other: "other",
};
const M = { acrylic: "Acrylic on Canvas", oil: "Oil on Canvas", ink: "Ink", water: "Watercolor", mixed: "Ceramic & Mixed Media" };
const B = "marketplace_and_aggregator" as const, MK = "marketplace_only" as const, AG = "aggregator_only" as const;

const PIECES: Piece[] = [
  { id: "p01", artist: "artist1", title: "Tree of Life at Dawn", type: T.madhubani, medium: M.ink, dims: "24 x 36 in", year: 2025, price: 42000, listing: B, rank: "R", end: "live", ageDays: 90, nfc: "locked" },
  { id: "p02", artist: "artist1", title: "Fish and the Lotus Pond", type: T.madhubani, medium: M.ink, dims: "18 x 24 in", year: 2026, price: 28000, listing: B, rank: "U", end: "live", ageDays: 40, nfc: "locked" },
  { id: "p03", artist: "artist1", title: "Wedding Procession", type: T.madhubani, medium: M.water, dims: "30 x 40 in", year: 2024, price: 65000, listing: MK, rank: "R", end: "live", ageDays: 100, nfc: "locked" },
  { id: "p04", artist: "artist2", title: "Harvest Dance", type: T.warli, medium: M.acrylic, dims: "24 x 24 in", year: 2026, price: 18000, listing: B, rank: "O", end: "live", ageDays: 70, nfc: "locked" },
  { id: "p05", artist: "artist2", title: "Village in Monsoon", type: T.warli, medium: M.acrylic, dims: "36 x 48 in", year: 2025, price: 52000, listing: B, rank: "U", end: "live", ageDays: 45, nfc: "locked" },
  { id: "p06", artist: "artist2", title: "Moon Festival (draft)", type: T.warli, medium: M.acrylic, dims: "20 x 20 in", year: 2026, price: 15000, listing: B, rank: null, end: "review", ageDays: 2 },
  { id: "p07", artist: "artist3", title: "The Tiger and the Banyan", type: T.gond, medium: M.acrylic, dims: "30 x 30 in", year: 2026, price: 36000, listing: B, rank: "U", end: "live", ageDays: 62, nfc: "locked" },
  { id: "p08", artist: "artist3", title: "Peacock Council", type: T.gond, medium: M.acrylic, dims: "24 x 36 in", year: 2025, price: 31000, listing: B, rank: "O", end: "live", ageDays: 55, nfc: "locked" },
  { id: "p09", artist: "artist3", title: "Forest Spirit (sketch)", type: T.gond, medium: M.ink, dims: "12 x 16 in", year: 2026, price: 9000, listing: MK, rank: null, end: "draft", ageDays: 1 },
  { id: "p10", artist: "artist4", title: "Krishna and the Cowherds", type: T.kalamkari, medium: M.water, dims: "36 x 24 in", year: 2025, price: 47000, listing: B, rank: "U", end: "live", ageDays: 75, nfc: "locked" },
  { id: "p11", artist: "artist4", title: "River of Lotuses", type: T.kalamkari, medium: M.water, dims: "24 x 30 in", year: 2026, price: 26000, listing: B, rank: "O", end: "live", ageDays: 58, nfc: "locked" },
  { id: "p12", artist: "artist4", title: "Ramayana Panel", type: T.kalamkari, medium: M.water, dims: "48 x 24 in", year: 2024, price: 88000, listing: MK, rank: "R", end: "live", ageDays: 50, nfc: "unlocked" },
  { id: "p13", artist: "artist5", title: "Gold-Leaf Balakrishna", type: T.tanjore, medium: M.mixed, dims: "18 x 24 in", year: 2026, price: 120000, listing: B, rank: "R", end: "live", ageDays: 66, nfc: "locked" },
  { id: "p14", artist: "artist5", title: "Lakshmi on the Lotus", type: T.tanjore, medium: M.mixed, dims: "24 x 30 in", year: 2025, price: 95000, listing: MK, rank: "U", end: "live", ageDays: 48, nfc: "locked" },
  { id: "p15", artist: "artist5", title: "Nataraja (returned for edits)", type: T.tanjore, medium: M.mixed, dims: "30 x 36 in", year: 2026, price: 140000, listing: B, rank: null, end: "rejected", ageDays: 10 },
  { id: "p16", artist: "artist6", title: "Pabuji ki Phad", type: T.phad, medium: M.water, dims: "60 x 24 in", year: 2025, price: 76000, listing: B, rank: "R", end: "live", ageDays: 82, nfc: "locked" },
  { id: "p17", artist: "artist6", title: "Camel Caravan", type: T.phad, medium: M.water, dims: "24 x 24 in", year: 2026, price: 22000, listing: B, rank: "S", end: "live", ageDays: 35, nfc: "locked" },
  { id: "p18", artist: "artist6", title: "Sold on another platform", type: T.phad, medium: M.water, dims: "18 x 18 in", year: 2024, price: 14000, listing: B, rank: "S", end: "external", ageDays: 30 },
  { id: "p19", artist: "artist7", title: "Jagannath Trio", type: T.pattachitra, medium: M.water, dims: "24 x 18 in", year: 2026, price: 24000, listing: B, rank: null, end: "review", ageDays: 3 },
  { id: "p20", artist: "artist7", title: "Rasa Lila", type: T.pattachitra, medium: M.water, dims: "30 x 20 in", year: 2026, price: 33000, listing: B, rank: null, end: "review", ageDays: 5 },
  { id: "p21", artist: "artist7", title: "Palm-leaf Study", type: T.pattachitra, medium: M.ink, dims: "10 x 14 in", year: 2026, price: 8000, listing: MK, rank: null, end: "draft", ageDays: 2 },
  { id: "p22", artist: "artist8", title: "Blue Noise No. 4", type: T.other, medium: M.acrylic, dims: "40 x 40 in", year: 2026, price: 54000, listing: B, rank: null, end: "rejected", ageDays: 14 },
  { id: "p23", artist: "artist8", title: "Monsoon Grid", type: T.other, medium: M.acrylic, dims: "30 x 30 in", year: 2026, price: 39000, listing: B, rank: null, end: "review", ageDays: 6 },
  { id: "p24", artist: "artist8", title: "Untitled Study", type: T.other, medium: M.oil, dims: "16 x 20 in", year: 2025, price: 17000, listing: MK, rank: null, end: "draft", ageDays: 4 },
  { id: "p25", artist: "artist9", title: "First Light", type: T.other, medium: M.oil, dims: "20 x 24 in", year: 2026, price: 21000, listing: B, rank: null, end: "draft", ageDays: 1 },
  { id: "p26", artist: "artist9", title: "Pune Rooftops", type: T.other, medium: M.water, dims: "14 x 20 in", year: 2026, price: 12000, listing: MK, rank: null, end: "draft", ageDays: 1 },
  { id: "p27", artist: "artist9", title: "Chai Stall at Dusk", type: T.other, medium: M.oil, dims: "18 x 24 in", year: 2026, price: 16000, listing: B, rank: null, end: "review", ageDays: 1 },
  { id: "p28", artist: "artist10", title: "Wheel of Life Thangka", type: T.thangka, medium: M.mixed, dims: "30 x 40 in", year: 2025, price: 98000, listing: B, rank: "R", end: "live", ageDays: 60, nfc: "locked" },
  { id: "p29", artist: "artist10", title: "Green Tara", type: T.thangka, medium: M.mixed, dims: "20 x 28 in", year: 2026, price: 72000, listing: B, rank: "U", end: "live", ageDays: 52, nfc: "locked" },
  { id: "p30", artist: "artist10", title: "Mountain Mandala", type: T.thangka, medium: M.mixed, dims: "24 x 24 in", year: 2026, price: 44000, listing: MK, rank: "O", end: "live", ageDays: 20, nfc: "locked" },
  // Extra live pieces nobody has bought or reserved, so browsing, search, filters and the buy flow have stock.
  { id: "p31", artist: "artist1", title: "Sita Swayamvar", type: T.madhubani, medium: M.ink, dims: "20 x 30 in", year: 2026, price: 34000, listing: B, rank: "R", end: "live", ageDays: 30, nfc: "locked" },
  { id: "p32", artist: "artist1", title: "Kohbar Ghar", type: T.madhubani, medium: M.water, dims: "24 x 24 in", year: 2025, price: 26500, listing: MK, rank: "O", end: "live", ageDays: 28, nfc: "locked" },
  { id: "p33", artist: "artist2", title: "Tarpa Dance", type: T.warli, medium: M.acrylic, dims: "30 x 30 in", year: 2026, price: 21000, listing: B, rank: "S", end: "live", ageDays: 27, nfc: "locked" },
  { id: "p34", artist: "artist2", title: "Fishing Village", type: T.warli, medium: M.acrylic, dims: "18 x 24 in", year: 2026, price: 14500, listing: MK, rank: "S", end: "live", ageDays: 26, nfc: "locked" },
  { id: "p35", artist: "artist3", title: "Night Owls", type: T.gond, medium: M.acrylic, dims: "24 x 24 in", year: 2026, price: 27000, listing: B, rank: "O", end: "live", ageDays: 25, nfc: "locked" },
  { id: "p36", artist: "artist3", title: "Gond Elephant Procession", type: T.gond, medium: M.acrylic, dims: "36 x 48 in", year: 2025, price: 58000, listing: B, rank: "U", end: "live", ageDays: 24, nfc: "locked" },
  { id: "p37", artist: "artist4", title: "Tree of Knowledge", type: T.kalamkari, medium: M.water, dims: "24 x 36 in", year: 2026, price: 39000, listing: B, rank: "U", end: "live", ageDays: 23, nfc: "locked", cat: "textile" },
  { id: "p38", artist: "artist4", title: "Kalamkari Peacock Scroll", type: T.kalamkari, medium: M.water, dims: "60 x 18 in", year: 2025, price: 45000, listing: MK, rank: "O", end: "live", ageDays: 22, nfc: "locked", cat: "textile" },
  { id: "p39", artist: "artist5", title: "Radha Krishna in Gold", type: T.tanjore, medium: M.mixed, dims: "24 x 30 in", year: 2026, price: 110000, listing: B, rank: "R", end: "live", ageDays: 21, nfc: "locked" },
  { id: "p40", artist: "artist5", title: "Ganesha, Mysore School", type: T.tanjore, medium: M.mixed, dims: "18 x 24 in", year: 2025, price: 62000, listing: MK, rank: "U", end: "live", ageDays: 20, nfc: "locked" },
  { id: "p41", artist: "artist6", title: "Devnarayan ki Phad", type: T.phad, medium: M.water, dims: "48 x 24 in", year: 2025, price: 54000, listing: B, rank: "U", end: "live", ageDays: 19, nfc: "locked" },
  { id: "p42", artist: "artist6", title: "Ghoomar", type: T.phad, medium: M.water, dims: "20 x 20 in", year: 2026, price: 16500, listing: MK, rank: "S", end: "live", ageDays: 18, nfc: "locked" },
  { id: "p43", artist: "artist10", title: "Medicine Buddha", type: T.thangka, medium: M.mixed, dims: "24 x 36 in", year: 2025, price: 135000, listing: B, rank: "R", end: "live", ageDays: 17, nfc: "locked" },
  { id: "p44", artist: "artist10", title: "White Tara", type: T.thangka, medium: M.mixed, dims: "16 x 20 in", year: 2026, price: 38000, listing: MK, rank: "O", end: "live", ageDays: 16, nfc: "locked" },
  { id: "p45", artist: "artist1", title: "Linocut: Bihar Lotus", type: T.madhubani, medium: M.ink, dims: "12 x 16 in", year: 2026, price: 6500, listing: MK, rank: "S", end: "live", ageDays: 15, nfc: "locked", cat: "printmaking" },
  { id: "p46", artist: "artist2", title: "Ceramic Warli Platter", type: T.warli, medium: M.mixed, dims: "14 x 14 in", year: 2026, price: 9500, listing: MK, rank: "S", end: "live", ageDays: 14, nfc: "locked", cat: "ceramics" },
  { id: "p47", artist: "artist3", title: "Mixed-media Forest Map", type: T.gond, medium: M.mixed, dims: "30 x 40 in", year: 2026, price: 29000, listing: B, rank: "O", end: "live", ageDays: 13, nfc: "locked", cat: "mixed-media" },
  { id: "p48", artist: "artist5", title: "Rare Gold Folio (no tag yet)", type: T.tanjore, medium: M.mixed, dims: "12 x 16 in", year: 2026, price: 72000, listing: MK, rank: "R", end: "live", ageDays: 12 },
  // General (G): the entry tier. The last one is a legacy piece approved before ranks existed (no rank stored); buyers see it as General too.
  { id: "p49", artist: "artist1", title: "Village Well (study)", type: T.madhubani, medium: M.ink, dims: "12 x 16 in", year: 2026, price: 7500, listing: MK, rank: "G", end: "live", ageDays: 11, nfc: "locked" },
  { id: "p50", artist: "artist2", title: "Bus Stop at Dahanu", type: T.warli, medium: M.acrylic, dims: "16 x 20 in", year: 2026, price: 8800, listing: MK, rank: "G", end: "live", ageDays: 10, nfc: "locked" },
  { id: "p51", artist: "artist3", title: "Bamboo Grove", type: T.gond, medium: M.ink, dims: "14 x 18 in", year: 2026, price: 9800, listing: B, rank: "G", end: "live", ageDays: 9, nfc: "locked" },
  { id: "p52", artist: "artist4", title: "Cotton Loom", type: T.kalamkari, medium: M.water, dims: "18 x 24 in", year: 2026, price: 11000, listing: B, rank: "G", end: "live", ageDays: 8, nfc: "locked", cat: "textile" },
  { id: "p53", artist: "artist6", title: "Festival Lamps", type: T.phad, medium: M.water, dims: "16 x 16 in", year: 2026, price: 7000, listing: MK, rank: "G", end: "live", ageDays: 7, nfc: "locked" },
  { id: "p54", artist: "artist10", title: "Prayer Flags", type: T.thangka, medium: M.ink, dims: "12 x 16 in", year: 2026, price: 8400, listing: MK, rank: "G", end: "live", ageDays: 6, nfc: "locked" },
  { id: "p55", artist: "artist5", title: "Temple Gopuram (legacy, unranked)", type: T.tanjore, medium: M.mixed, dims: "14 x 18 in", year: 2024, price: 13000, listing: MK, rank: "S", legacy: true, end: "live", ageDays: 120, nfc: "locked" },
];

say("artworks: submit -> moderate -> rank -> tag (55 pieces)");
const art = new Map<string, string>(); // piece id -> artwork id
const adminId = uid("admin");
/** A chip ID shaped like a real NTAG213's: NXP's 0x04, then six bytes that differ chip to chip. */
const demoTagUid = (artworkId: string) => `04${createHash("sha256").update(artworkId).digest("hex").slice(0, 12)}`;
for (const [n, p] of PIECES.entries()) {
  const artistId = uid(p.artist);
  const { artworkId } = await submitArtwork({
    db, artistId, title: p.title, description: `${p.title}, ${p.type.split(": ")[1] ?? "contemporary"} work by ${nameOf(p.artist)}. Signed on the reverse; ships framed with its certificate and tag.`,
    category: p.cat ?? "painting", medium: p.medium, artistPricePaise: rs(p.price), listingType: p.listing, dimensions: p.dims, yearCreated: p.year,
    artworkType: p.type, mode: p.end === "draft" || p.end === "external" ? "draft" : "review", exclusive: n % 4 === 0, rates,
    physical: { weightKg: 3, framing: "Framed", format: "Rectangle", hangingHardwareIncluded: true, packagingConfirmed: true },
  });
  art.set(p.id, artworkId);
  const f = IMAGES[n % IMAGES.length]!;
  for (const [s, file] of [f, IMAGES[(n + 3) % IMAGES.length]!].entries()) {
    await db.collection(artworkImagesCol(artworkId)).doc(`img${s}`).set({ url: imageUrl(file), thumbnailUrl: imageUrl(file), altText: p.title, sortOrder: s, storagePath: `demo/${artworkId}/${file}` });
  }
  if (p.end === "rejected") await rejectArtwork(db, artworkId, "The photo is blurred and the dimensions do not match the listing. Please resubmit.", adminId);
  if (p.end === "external") await markSoldElsewhere(db, { artistId, artworkId, rates });
  if (p.end === "live") {
    await setArtworkRarity(db, artworkId, p.rank!, adminId);
    await approveArtwork(db, artworkId, adminId);
    if (p.legacy) await db.collection(Collections.artworks).doc(artworkId).update({ rarityType: null }); // approved before ranks existed
    if (p.nfc) {
      const uidHex = demoTagUid(artworkId);
      const actor = { uid: artistId, role: "artist" };
      await linkNfcTag(db, { artworkId, tagUid: uidHex, actor });
      if (p.nfc === "locked") await lockNfcTag(db, { artworkId, tagUid: uidHex, actor });
    }
  }
  // backdate: spread listing dates so edit windows differ (some still editable, most closed)
  await backdate(db.collection(Collections.artworks).doc(artworkId), { createdAt: daysAgo(p.ageDays), editableUntil: daysAgo(p.ageDays - rates.artistEditWindowDays) });
  await refreshListing(db, artworkId, rates);
}

// --- Aggregators: wallets, then each at a different point of the 30-day placement ----------
say("aggregators: wallet top-ups");
for (const k of ["aggregator1", "aggregator2", "aggregator3", "aggregator4"]) {
  for (let i = 0; i < 3; i++) {
    const { topupId } = await createWalletTopup(db, { userId: uid(k), amountPaise: rs(50000) });
    await markTopupPaid(db, topupId, { method: "upi", providerPaymentId: `pay_demo_${k}_${i}` });
  }
}
const { topupId: lowTopup } = await createWalletTopup(db, { userId: uid("aggregator5"), amountPaise: rs(5000) });
await markTopupPaid(db, lowTopup, { method: "card", providerPaymentId: "pay_demo_aggregator5_0" });

const HOLD = new Map<string, string>();
async function hold(piece: string, agg: string, dayOfWindow: number, opts: { price?: number } = {}): Promise<string> {
  const r = await reserveHolding({ db, aggregatorId: uid(agg), artworkId: art.get(piece)!, ...(opts.price ? { sellingPricePaise: rs(opts.price) } : {}) });
  const assigned = daysAgo(dayOfWindow);
  // backdate: the holding was created `dayOfWindow` days ago; the placement window is 30 days
  await backdate(db.collection(Collections.aggregatorHoldings).doc(r.holdingId), { assignedAt: assigned, expiresAt: new Date(assigned.getTime() + rates.aggregatorPlacementDays * 86_400_000) });
  await refreshListing(db, art.get(piece)!, rates);
  HOLD.set(`${piece}:${agg}`, r.holdingId);
  return r.holdingId;
}
const sale = (holdingId: string, buyerName: string, route: "direct_to_galleryzone" | "cash_at_premises", mode: "courier" | "self_pickup" = "courier") =>
  db.collection(Collections.aggregatorHoldings).doc(holdingId).get().then((s) =>
    recordAggregatorSale({ db, holdingId, soldPricePaise: (s.data() as { displayPricePaise: number }).displayPricePaise, buyerName, buyerEmail: `${buyerName.split(" ")[0]!.toLowerCase()}@example.in`, buyerPhone: "+91 90000 11111", deliveryAddress: "14 MG Road, Bengaluru 560001", deliveryMode: mode, paymentRoute: route }));

say("aggregator 1 - Kala Ghar: just reserved (day 3 of 30), priced above GalleryZone's offer");
await hold("p02", "aggregator1", 3, { price: 42000 });

say("aggregator 2 - Rangmanch: day 26 of 30 with a pending extension request, plus a day-12 piece");
const h2 = await hold("p05", "aggregator2", 26);
await requestHoldingExtension(db, { aggregatorId: uid("aggregator2"), holdingId: h2, assurance: "Two collectors are visiting this weekend and one has asked for a private viewing.", rates, now: daysAgo(1) });
await hold("p08", "aggregator2", 12);

say("aggregator 3 - Jaipur Canvas: sold within the window (cash sale awaiting remittance; courier sale in transit)");
const h3a = await hold("p07", "aggregator3", 18);
await sale(h3a, "Kavita Menon", "cash_at_premises", "self_pickup");
const h3b = await hold("p10", "aggregator3", 22);
const s3b = await sale(h3b, "Arjun Malhotra", "direct_to_galleryzone");
await advanceShipment(db, uid("aggregator3"), s3b.saleId, "dispatched", "AWB-DEMO-4471");
await db.collection(Collections.aggregatorSales).doc(s3b.saleId).update({ shiprocketStage: "in_transit", trackingId: "SR-DEMO-4471", carrier: "Delhivery", trackedAt: ts(daysAgo(1)) });
const h3c = await hold("p11", "aggregator3", 9);
await createHoldingReport(db, { holdingId: h3c, aggregatorId: uid("aggregator3"), issueType: "damaged_in_transit", description: "A corner of the frame arrived cracked. Photos attached on request." });
const rep2 = await createHoldingReport(db, { holdingId: h3c, aggregatorId: uid("aggregator3"), issueType: "coa_nfc_problem", description: "The NFC tag does not scan with the app." });
await resolveHoldingReport(db, { reportId: rep2.id, adminId, note: "Re-tested: tag reads fine. Asked the gallery to scan near the top edge." });

say("aggregator 4 - Bengal Atelier: two months complete (window extended once, sold on day 52, delivered, remitted) and a piece returned unsold");
const h4 = await hold("p13", "aggregator4", 65);
await requestHoldingExtension(db, { aggregatorId: uid("aggregator4"), holdingId: h4, assurance: "A corporate buyer has shortlisted this piece for a lobby installation.", rates, now: daysAgo(37) });
await decideHoldingExtension(db, { holdingId: h4, adminId, decision: "approved", note: "Approved: one more placement.", rates, now: daysAgo(36) });
const s4 = await sale(h4, "Sanjay Gupta", "cash_at_premises");
await backdate(db.collection(Collections.aggregatorSales).doc(s4.saleId), { soldAt: daysAgo(13) });
await advanceShipment(db, uid("aggregator4"), s4.saleId, "dispatched", "AWB-DEMO-9012");
await advanceShipment(db, uid("aggregator4"), s4.saleId, "delivered");
await markRemitted(db, uid("aggregator4"), s4.saleId, "bank");
const h4r = await hold("p16", "aggregator4", 58);
await returnHolding(db, uid("aggregator4"), h4r); // unsold at day 30 -> back to the marketplace, offered to the next gallery
await backdate(db.collection(Collections.aggregatorHoldings).doc(h4r), { returnedAt: daysAgo(28) });

say("aggregator 5 - Southern Strokes: second placement of the piece Bengal Atelier returned (month 2, price drops 2%), low wallet");
const topup5 = await createWalletTopup(db, { userId: uid("aggregator5"), amountPaise: rs(50000) });
await markTopupPaid(db, topup5.topupId, { method: "netbanking", providerPaymentId: "pay_demo_aggregator5_1" });
await hold("p16", "aggregator5", 25);

// --- Marketplace orders: one in every status --------------------------------------------
say("customers: addresses, orders in every status, carts");
const addr = new Map<string, string>();
for (const k of ["customer1", "customer2", "customer3", "customer4", "customer5", "customer6"]) {
  const p = PEOPLE.find((x) => x.key === k)!;
  const { id } = await addAddress(db, uid(k), { line1: "221B Residency Road", line2: null, city: p.city, state: p.state, pincode: p.pin, isDefault: true });
  addr.set(k, id);
}
const quote = { carrier: "Delhivery", ratePaise: 62000, courierCompanyId: 12, estimatedDeliveryDays: 4 };
async function order(piece: string, cust: string, upTo: "pending" | "paid" | "confirmed" | "packed" | "transit" | "delivered" | "cancelled", ageDays = 0) {
  const { orderId } = await createOrder({ db, customerId: uid(cust), artworkId: art.get(piece)!, addressId: addr.get(cust)!, idempotencyKey: `demo-${piece}-${cust}`, deliveryQuote: quote });
  if (upTo !== "pending") await confirmSimulatedPayment(db, orderId);
  const path = ["confirmed", "packed", "transit", "delivered"] as const;
  if (upTo === "cancelled") await advanceOrderStatus(db, orderId, "cancelled");
  else for (const s of path) { if (["paid", "pending"].includes(upTo)) break; await advanceOrderStatus(db, orderId, s); if (s === upTo) break; }
  if (ageDays) await backdate(db.collection(Collections.orders).doc(orderId), { createdAt: daysAgo(ageDays) });
  return orderId;
}
const oDelivered = await order("p01", "customer1", "delivered", 40);
await order("p03", "customer2", "transit", 5);
await order("p04", "customer3", "packed", 3);
await order("p14", "customer4", "confirmed", 2);
await order("p28", "customer5", "paid", 1);
await order("p29", "customer6", "pending", 0);
await order("p30", "customer1", "cancelled", 6);
await addToCart(db, uid("customer2"), art.get("p12")!);
await addToCart(db, uid("customer2"), art.get("p17")!);
await addToCart(db, uid("customer3"), art.get("p17")!);

// --- Ownership: transfers, display loans, resale, physical certificates ------------------
say("ownership: transfer (accepted / pending / cancelled), display loan, resale listing + sale, physical COA");
const p01 = art.get("p01")!;
const t1 = await initiateTransfer(db, { artworkId: p01, byUserId: uid("customer1"), kind: "ownership", toName: nameOf("customer3"), toEmail: emailOf("customer3") });
await acceptTransfer(db, { transferId: t1.id, byUserId: uid("customer3") }); // p01 now belongs to customer3
const t2 = await initiateTransfer(db, { artworkId: p01, byUserId: uid("customer3"), kind: "display", toName: "Kala Ghar Gallery", toEmail: emailOf("aggregator1"), displayStartsAt: daysAgo(5), displayEndsAt: new Date(Date.now() + 25 * 86_400_000) });
await acceptTransfer(db, { transferId: t2.id, byUserId: uid("aggregator1") });
// the artist's own unsold work handed to a collector: pending (never accepted) and cancelled
const p03 = art.get("p03")!;
const tPending = await initiateTransfer(db, { artworkId: p03, byUserId: uid("customer2"), kind: "ownership", toName: nameOf("customer4"), toEmail: emailOf("customer4") });
const tCancel = await initiateTransfer(db, { artworkId: art.get("p14")!, byUserId: uid("customer4"), kind: "ownership", toName: nameOf("customer5"), toEmail: emailOf("customer5") }).catch(() => null);
if (tCancel) await cancelTransfer(db, { transferId: tCancel.id, byUserId: uid("customer4") });
void tPending;
const resale = await createResaleListing(db, uid("customer3"), p01, rs(70000)).catch(() => null);
if (resale) { await completeResaleSale(db, uid("customer3"), resale.id).catch(() => null); }
await db.collection(Collections.physicalCoaRequests).add({ artworkId: art.get("p03")!, requestedByUserId: uid("customer2"), requestedAt: ts(daysAgo(2)), deliveryLine1: "221B Residency Road", deliveryCity: "Kochi", deliveryState: "Kerala", deliveryPincode: "682001", status: "requested", dispatchedAt: null, courierRef: null });
await db.collection(Collections.physicalCoaRequests).add({ artworkId: p01, requestedByUserId: uid("customer1"), requestedAt: ts(daysAgo(30)), deliveryLine1: "221B Residency Road", deliveryCity: "Gurugram", deliveryState: "Haryana", deliveryPincode: "122001", status: "dispatched", dispatchedAt: ts(daysAgo(26)), courierRef: "AWB-COA-5521" });

// --- Money: withdrawals (every status), settlements, reservation intents ---------------
say("money: withdrawals in every status, settlement states, reservation intents");
const w1 = await requestWithdrawal({ db, userId: uid("artist1"), accountType: "artist_payable", amountPaise: rs(2000), rates }).catch((e) => { console.log("  (withdrawal skipped:", String(e).slice(0, 90), ")"); return null; });
if (w1) await approveWithdrawal(db, w1.withdrawalId, "artist_payable");
const w2 = await requestWithdrawal({ db, userId: uid("artist1"), accountType: "artist_payable", amountPaise: rs(1500), rates }).catch(() => null);
if (w2) await rejectWithdrawal(db, w2.withdrawalId);
await requestWithdrawal({ db, userId: uid("artist1"), accountType: "artist_payable", amountPaise: rs(1200), rates }).catch(() => null);
await requestWithdrawal({ db, userId: uid("aggregator4"), accountType: "aggregator_payable", amountPaise: rs(10000), rates }).catch(() => null);
// Nothing in the backend writes the settlements read model (the ledger is the source of truth), so the
// admin queue is filled here from the recorded artist sales: paid out once past their 7-day release, one failed.
const artistSales = await db.collection(Collections.artistSales).get();
for (const [i, d] of artistSales.docs.entries()) {
  const x = d.data() as { artistId: string; channel: string; artistPricePaise: number; netPaise: number; orderId: string | null; holdingId: string | null; soldAt: Timestamp };
  const releaseAt = new Date(x.soldAt.toDate().getTime() + rates.artistPayoutDaysAfterDelivery * 86_400_000);
  const due = releaseAt.getTime() < Date.now();
  const status = !due ? "pending" : i === 1 ? "failed" : "processed";
  await db.collection(Collections.settlements).add({
    orderId: x.orderId, holdingId: x.holdingId, artistId: x.artistId, artistAmountPaise: x.netPaise,
    aggregatorCommissionPaise: x.channel === "aggregator" ? Math.round(x.artistPricePaise * 0.06) : null,
    platformRevenuePaise: Math.round(x.artistPricePaise * (x.channel === "aggregator" ? 0.24 : 0.3)),
    status, releaseAfter: ts(releaseAt), createdAt: x.soldAt, processedAt: status === "processed" ? ts(releaseAt) : null,
  });
}
const intent = (status: string, extra: Record<string, unknown>) => db.collection(Collections.reservationIntents).add({
  aggregatorId: uid("aggregator5"), artworkId: art.get("p12")!, sellingPricePaise: null, advanceAmountPaise: rs(4400), deliveryDepositPaise: rs(2500), totalPayablePaise: rs(6900),
  idempotencyKey: `demo-intent-${status}`, providerOrderId: `order_demo_${status}`, providerPaymentId: null, providerRefundId: null, holdingId: null, failureReason: null,
  status, createdAt: ts(daysAgo(1)), expiresAt: ts(daysAgo(0)), paidAt: null, finalizedAt: null, refundedAt: null, ...extra,
});
await intent("needs_refund", { providerPaymentId: "pay_demo_lost_race", paidAt: ts(daysAgo(1)), failureReason: "Another gallery reserved this piece first." });
await intent("refunded", { providerPaymentId: "pay_demo_refunded", providerRefundId: "rfnd_demo_1", paidAt: ts(daysAgo(2)), refundedAt: ts(daysAgo(2)) });
await intent("expired", { failureReason: "Not paid in time." });

// --- Admin/moderation surfaces -------------------------------------------------------------
say("blogs (submitted / accepted / rejected), support, messages, reviews, connections, disputes, deactivation, audit log, shelf");
const blog = (a: string, title: string) => submitBlog(db, { authorId: uid(a), authorName: nameOf(a), title, excerpt: "", body: `${title}.\n\nA few paragraphs from the studio about process, materials and the stories behind the work.\n\nWritten for GalleryZone readers.` });
await blog("artist1", "How a Madhubani painting is made, step by step");
const b2 = await blog("artist3", "Gond art: why every line is a drawing of the forest");
await acceptBlog(db, { blogId: b2.id, adminId });
const b3 = await blog("artist8", "Ten tips to sell abstract art online");
await rejectBlog(db, { blogId: b3.id, adminId, reason: "Reads like an advertisement; please add your own process and examples." });
const b4 = await blog("artist5", "Working with 22-carat gold leaf on Tanjore panels");
await acceptBlog(db, { blogId: b4.id, adminId });

await submitSupportTicket(db, uid("customer1"), "Invoice for my order", "Could I get the GST invoice as a PDF for the Madhubani piece I bought?");
await submitSupportTicket(db, uid("artist2"), "How do I lock the NFC tag?", "I linked the tag from the app but the website still says it is not locked.");
const answered = await submitSupportTicket(db, uid("aggregator3"), "Remittance deadline", "When exactly is the cash remittance due for my in-gallery sale?");
await db.collection(Collections.supportTickets).doc(answered.id).update({ status: "answered" });
for (const [k, from, subject] of [["artist1", "GalleryZone", "Your artwork is live"], ["artist7", "GalleryZone", "KYC under review"], ["aggregator2", "GalleryZone", "Extension request received"], ["customer2", "GalleryZone", "Welcome to GalleryZone"]] as const) {
  await db.collection(Collections.messageThreads).add({ userId: uid(k), fromLabel: from, subject, preview: `${subject}. Open to read more.`, body: `${subject}.\n\nThis is a demo message so every inbox has something in it.`, unread: k !== "customer2", receivedAt: ts(daysAgo(2)) });
}
for (const [i, who] of ["customer1", "customer3", "customer2"].entries()) {
  await db.collection(Collections.artistReviews).add({ artistId: uid("artist1"), reviewerName: nameOf(who), rating: 5 - (i % 2), comment: ["Exactly as described, and the certificate made gifting it easy.", "Beautiful work, packed with great care.", "Lovely colours; delivery took a little longer than quoted."][i], artworkId: p01, createdAt: ts(daysAgo(10 + i)) });
}
await db.collection(Collections.artistConnections).add({ requesterId: uid("artist1"), recipientId: uid("artist2"), status: "accepted", message: "Would love to collaborate on a joint show.", requestedAt: ts(daysAgo(20)), respondedAt: ts(daysAgo(19)) });
await db.collection(Collections.artistConnections).add({ requesterId: uid("artist9"), recipientId: uid("artist3"), status: "pending", message: "Big fan of your Gond work.", requestedAt: ts(daysAgo(2)), respondedAt: null });
await db.collection(Collections.disputes).add({ orderId: oDelivered, artworkId: p01, raisedByUserId: uid("customer1"), reason: "Frame corner dented on arrival.", status: "open", createdAt: ts(daysAgo(35)), resolvedAt: null, resolutionNote: null });
await db.collection(Collections.disputes).add({ orderId: null, artworkId: art.get("p03")!, raisedByUserId: uid("customer2"), reason: "Colour looks different from the listing photo.", status: "resolved", createdAt: ts(daysAgo(12)), resolvedAt: ts(daysAgo(9)), resolutionNote: "Photo re-shot and listing updated." });
await requestDeactivation(db, uid("artist9"), "Taking a break from selling to focus on a degree.").catch(() => null);
const fees = await db.collection(Collections.externalSalePenalties).get();
if (fees.docs[0]) await decideExternalSaleFee(db, fees.docs[0].id, adminId, "approved", "Confirmed with the artist.").catch(() => null);
for (const [action, type, label] of [["artwork.approved", "artwork", "Tree of Life at Dawn"], ["kyc.rejected", "user", "Farhan Qureshi"], ["extension.approved", "holding", "Gold-Leaf Balakrishna"], ["blog.accepted", "blog", "Gond art blog"]] as const) {
  await db.collection(Collections.auditLog).add({ adminId, action, entityType: type, entityId: "demo", entityLabel: label, detail: { demo: true }, createdAt: ts(daysAgo(3)) });
}
try {
  const shelf = JSON.parse(readFileSync(resolve(here, "affiliate-products.seed.json"), "utf8")) as { title: string }[];
  const ready = shelf.filter((x) => x.title?.trim());
  if (ready.length) { const r = await seedAffiliateProducts(db, ready as never); console.log(`  art-supplies shelf: ${JSON.stringify(r)}`); }
} catch (e) { console.log("  (art-supplies shelf skipped:", String(e).slice(0, 100), ")"); }

// --- Summary -------------------------------------------------------------------------------------
const count = async (c: string) => (await db.collection(c).count().get()).data().count;
console.log("\nSeeded:", Object.fromEntries(await Promise.all(["users", "artworks", "aggregatorHoldings", "aggregatorSales", "orders", "settlements", "ledgerEntries", "withdrawalRequests", "blogs"].map(async (c) => [c, await count(c)]))));
console.log(`\nSign in with password ${PASSWORD}: ${emailOf("admin")}, ${emailOf("artist1")}, ${emailOf("aggregator1")}, ${emailOf("customer1")} ...`);
void (null as unknown as Firestore);
