import type {
  Artwork,
  ArtworkImage,
  ArtworkStatus,
  SocialProofLink,
} from "@/types/artwork";
import { verifiedTierCount } from "@/types/artist";
import type {
  AdminActivityEvent,
  AdminKpis,
  AdminUser,
  AuditLogEntry,
  Category,
  GeneratedReport,
  KycStatus,
  PlatformSettings,
  Settlement,
  SettlementStatus,
  UserStatus,
  WithdrawalRequest,
  WithdrawalStatus,
} from "@/types/admin";
import { AGGREGATOR } from "@/features/aggregator/aggregator-data";
import { mockArtists } from "./artists";
import { mockArtworks } from "./artworks";
import { mockCustomer, mockOrders } from "./customer";
import {
  revenueSeries,
  topAggregators,
  topArtists,
  userGrowthSeries,
  verificationTiers,
  volumeSeries,
} from "./admin-analytics";

// ---------------------------------------------------------------------------
// Admin-only fixtures. Deliberately modest (explicit direction): enough rows
// that tables, search, filtering and pagination feel real, not a generated
// corpus. Nothing here modifies the fixtures the public marketplace reads —
// mockArtworks / mockArtists / mockOrders / mockAggregatorHoldings are
// imported read-only, and mockPendingArtworks is a SEPARATE array so the
// public site is completely unaffected by anything the admin console shows.
//
// Fixed "today" anchor (2026-08-11T00:00:00.000Z), matching every other
// mock-data file — see features/admin/admin-data.ts's ADMIN_TODAY for why
// Date.now() is deliberately avoided everywhere in this codebase.
//
// Known, deliberate looseness, so it reads as a decision rather than an
// oversight: settlement rows reference real artworks for their title/artist
// join, but are not reconciled against each artwork's *current* lifecycle
// status — the artwork fixtures are a shared read-only public set in which
// only one piece is "sold". The existing mockOrders fixture already has the
// same property (it holds delivered orders for artworks still listed as
// "marketplace"), so this follows established precedent rather than
// introducing a new inconsistency.
// ---------------------------------------------------------------------------

const TODAY = new Date("2026-08-11T00:00:00.000Z");

function daysAgo(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function history(...entries: Array<[ArtworkStatus, number]>) {
  return entries.map(([status, days]) => ({
    status,
    changedAt: daysAgo(days),
  }));
}

function artistMeta(artistId: string): {
  artistName: string;
  verifiedArtist: boolean;
} {
  const artist = mockArtists.find((a) => a.id === artistId);
  if (!artist)
    throw new Error(`mock-data/admin: unknown artistId "${artistId}"`);
  return {
    artistName: artist.name,
    verifiedArtist: verifiedTierCount(artist.verification) > 0,
  };
}

const IMG = {
  bird: "/artworks/bird.png",
  busts: "/artworks/collage-busts.png",
  drape: "/artworks/draped-figure.png",
  pyramid: "/artworks/eye-pyramid.png",
  framed: "/artworks/framed-painting.png",
  landscape: "/artworks/landscape.png",
  portrait: "/artworks/portrait-woman.png",
  eco1: "/ecosystem/artwork-1.png",
  eco2: "/ecosystem/artwork-2.png",
  eco3: "/ecosystem/artwork-3.png",
  journey: "/journey/artwork-preview.png",
  idPaint: "/identity/painting.png",
} as const;

const STAGE_LABELS = [
  "cover image",
  "detail of surface texture",
  "signature close-up",
  "scale reference against the gallery wall",
  "alternate angle",
  "studio lighting detail",
  "framing and edge detail",
  "full view in natural light",
];

function images(title: string, files: string[]): ArtworkImage[] {
  return files.map((url, i) => ({
    url,
    thumbnailUrl: url,
    sortOrder: i,
    altText: `${title}, ${STAGE_LABELS[i] ?? `detail view ${i + 1}`}`,
  }));
}

function social(links: SocialProofLink[]): SocialProofLink[] {
  return links;
}

// ---------------------------------------------------------------------------
// Pending / unlisted artworks — the moderation queue's actual work.
//
// 13 pieces: 9 awaiting review, 2 still drafts, and 2 "returned" (one
// rejected at review, one delisted after it had already been listed), so the
// admin catalog can show every non-public lifecycle state. All artistIds are
// real mockArtists ids and artistName/verifiedArtist are derived from that
// fixture, exactly as lib/mock-data/artworks.ts does, so the two can't drift.
// Descriptions never mention price or valuation (platform rule — Onboarding
// Guide, "No Price In Description"). COA numbers continue the existing
// GZ-COA-2026-#### sequence past artworks.ts's 0018. `insured` follows the
// documented ₹20,000 insurance-recommended threshold.
// ---------------------------------------------------------------------------

export const mockPendingArtworks: Artwork[] = [
  {
    id: "salt-flat-nocturne",
    title: "Salt Flat Nocturne",
    artistId: "kavya-iyer",
    ...artistMeta("kavya-iyer"),
    category: "photography",
    medium: "Archival Pigment Print",
    customerPrice: 14600,
    thumbnailUrl: IMG.portrait,
    insured: false,
    status: "pending_approval",
    listingType: "marketplace_only",
    description:
      "Shot on medium-format film across a single night on the Little Rann salt flats, waiting out the moon rather than lighting the scene. Printed as edition 3 of 9 on archival cotton rag from a hand-processed negative, with the grain left untouched in the sky. Signed and numbered on the reverse.",
    dimensions: "16x20 in",
    yearCreated: 2026,
    images: images("Salt Flat Nocturne", [IMG.portrait, IMG.bird, IMG.eco3]),
    coaCertificateNumber: "GZ-COA-2026-0019",
    coaIssueDate: daysAgo(2),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-salt-flat-nocturne/",
      },
    ]),
    statusHistory: history(["draft", 2], ["pending_approval", 0]),
  },
  {
    id: "wildfire-sutra",
    title: "Wildfire Sutra",
    artistId: "ishaan-kapoor",
    ...artistMeta("ishaan-kapoor"),
    category: "painting",
    medium: "Acrylic on Canvas",
    customerPrice: 28900,
    thumbnailUrl: IMG.framed,
    insured: true,
    status: "pending_approval",
    listingType: "marketplace_and_aggregator",
    description:
      "Painted over six weeks from sketches made during a controlled burn outside Dehradun, breaking the smoke line into the overlapping planes Ishaan has been working with since his stairwell series. The underpainting is left visible along the lower edge where the canvas was cropped after stretching. Full studio session filmed from blank canvas to final coat.",
    dimensions: "30x40 in",
    yearCreated: 2026,
    images: images("Wildfire Sutra", [
      IMG.framed,
      IMG.landscape,
      IMG.eco1,
      IMG.journey,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0020",
    coaIssueDate: daysAgo(4),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-wildfire-sutra",
      },
    ]),
    statusHistory: history(["draft", 4], ["pending_approval", 1]),
  },
  {
    id: "loom-song-in-indigo",
    title: "Loom Song in Indigo",
    artistId: "ananya-deshmukh",
    ...artistMeta("ananya-deshmukh"),
    category: "textile art",
    medium: "Hand Embroidery on Cotton, Natural Dye",
    customerPrice: 11800,
    thumbnailUrl: IMG.drape,
    insured: false,
    status: "pending_approval",
    listingType: "marketplace_only",
    description:
      "Hand-embroidered on handwoven cotton dyed in three successive indigo baths, each one left to oxidise in open air before the next. Ananya draws the running-stitch field freehand directly onto the cloth, so the density shifts across the piece rather than repeating. Ships with a fabric-care card and a wooden hanging dowel.",
    dimensions: "20x28 in",
    yearCreated: 2026,
    images: images("Loom Song in Indigo", [IMG.drape, IMG.eco2, IMG.journey]),
    coaCertificateNumber: "GZ-COA-2026-0021",
    coaIssueDate: daysAgo(5),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-loom-song-indigo/",
      },
    ]),
    statusHistory: history(["draft", 5], ["pending_approval", 2]),
  },
  {
    id: "foundry-light-study",
    title: "Foundry Light Study",
    artistId: "arjun-mehta",
    ...artistMeta("arjun-mehta"),
    category: "sculpture",
    medium: "Cast Bronze",
    customerPrice: 96500,
    thumbnailUrl: IMG.busts,
    insured: true,
    status: "pending_approval",
    listingType: "marketplace_and_aggregator",
    description:
      "A lost-wax bronze cast in Arjun's family workshop, taking the seated-figure motif he has returned to for years and opening the torso so light passes through it. The surface is left in its raw pour patina with the sprue marks ground back by hand rather than machine-finished. Filmed from wax model through to the final pour.",
    dimensions: "20 in H x 11 in W x 8 in D",
    yearCreated: 2026,
    images: images("Foundry Light Study", [
      IMG.busts,
      IMG.drape,
      IMG.pyramid,
      IMG.eco3,
      IMG.bird,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0022",
    coaIssueDate: daysAgo(8),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-foundry-light",
      },
    ]),
    statusHistory: history(["draft", 8], ["pending_approval", 3]),
  },
  {
    id: "ferry-whistle-nocturne",
    title: "Ferry Whistle Nocturne",
    artistId: "rohan-bhattacharya",
    ...artistMeta("rohan-bhattacharya"),
    category: "printmaking",
    medium: "Etching on Paper",
    customerPrice: 10900,
    thumbnailUrl: IMG.pyramid,
    insured: false,
    status: "pending_approval",
    listingType: "marketplace_only",
    description:
      "An etching of the last Hooghly ferry of the night pulling away from the ghat, bitten in three stages on a copper plate to push the water further into shadow than earlier prints in the series. Hand-inked and pulled individually on a proofing press. Numbered 4 of 14.",
    dimensions: "12x18 in",
    yearCreated: 2026,
    images: images("Ferry Whistle Nocturne", [
      IMG.pyramid,
      IMG.busts,
      IMG.eco2,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0023",
    coaIssueDate: daysAgo(9),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-ferry-whistle/",
      },
    ]),
    statusHistory: history(["draft", 9], ["pending_approval", 4]),
  },
  {
    id: "after-the-cyclone",
    title: "After the Cyclone",
    artistId: "meera-nair",
    ...artistMeta("meera-nair"),
    category: "painting",
    medium: "Oil on Canvas",
    customerPrice: 31700,
    thumbnailUrl: IMG.landscape,
    insured: true,
    status: "pending_approval",
    listingType: "marketplace_and_aggregator",
    description:
      "Painted from the Nagapattinam shoreline in the week after a cyclone crossed it, working wet-into-wet to hold the flattened, over-bright light that follows a storm. The debris line along the foreground is built in palette-knife impasto against an otherwise thinly glazed canvas. Ships with a signed Certificate of Authenticity and a studio video of the varnishing pass.",
    dimensions: "28x38 in",
    yearCreated: 2026,
    images: images("After the Cyclone", [
      IMG.landscape,
      IMG.framed,
      IMG.idPaint,
      IMG.journey,
      IMG.eco1,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0024",
    coaIssueDate: daysAgo(11),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-after-the-cyclone/",
      },
    ]),
    statusHistory: history(["draft", 11], ["pending_approval", 6]),
  },
  {
    id: "oxide-garden-panel",
    title: "Oxide Garden Panel",
    artistId: "priya-subramaniam",
    ...artistMeta("priya-subramaniam"),
    category: "mixed media",
    medium: "Repurposed Metal and Pigment on Panel",
    customerPrice: 51400,
    thumbnailUrl: IMG.busts,
    insured: true,
    status: "pending_approval",
    listingType: "marketplace_and_aggregator",
    description:
      "Sheet-metal offcuts from a Hyderabad scrapyard, welded into an overlapping leaf structure on a plywood panel and left under wet cloths for three weeks so the oxidation runs unevenly before sealing. Priya works without a finished drawing, cutting and placing each piece against the last. The final colour is a product of the rusting, not of applied pigment alone.",
    dimensions: "28 in H x 36 in W x 4 in D",
    yearCreated: 2026,
    images: images("Oxide Garden Panel", [
      IMG.busts,
      IMG.pyramid,
      IMG.drape,
      IMG.eco2,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0025",
    coaIssueDate: daysAgo(14),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-oxide-garden",
      },
    ]),
    statusHistory: history(["draft", 14], ["pending_approval", 8]),
  },
  {
    id: "projection-booth-no-3",
    title: "Projection Booth No. 3",
    artistId: "kavya-iyer",
    ...artistMeta("kavya-iyer"),
    category: "photography",
    medium: "Archival Pigment Print",
    customerPrice: 17200,
    thumbnailUrl: IMG.bird,
    insured: false,
    status: "pending_approval",
    listingType: "marketplace_only",
    description:
      "The third booth in Kavya's series on Bengaluru's single-screen cinemas, photographed mid reel-change with only the projector lamp lighting the room. Shot on medium-format film, hand-processed, and printed on archival cotton rag in an edition of nine. Signed and numbered on the reverse.",
    dimensions: "20x24 in",
    yearCreated: 2026,
    images: images("Projection Booth No. 3", [
      IMG.bird,
      IMG.portrait,
      IMG.eco1,
      IMG.journey,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0026",
    coaIssueDate: daysAgo(16),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-projection-booth-3/",
      },
    ]),
    statusHistory: history(["draft", 16], ["pending_approval", 11]),
  },
  {
    id: "quarry-fragment-ii",
    title: "Quarry Fragment II",
    artistId: "arjun-mehta",
    ...artistMeta("arjun-mehta"),
    category: "sculpture",
    medium: "Carved Marble",
    customerPrice: 84000,
    thumbnailUrl: IMG.drape,
    insured: true,
    status: "pending_approval",
    listingType: "marketplace_only",
    description:
      "Carved from a rejected Makrana block that cracked at the quarry, keeping the original fracture as the spine of the form rather than cutting around it. Hand-worked over eleven weeks with no mechanical finishing on the final passes, so the tool rhythm stays legible across the polished faces. Base included.",
    dimensions: "19 in H x 14 in W x 9 in D",
    yearCreated: 2025,
    images: images("Quarry Fragment II", [
      IMG.drape,
      IMG.busts,
      IMG.pyramid,
      IMG.eco3,
      IMG.bird,
      IMG.portrait,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0027",
    coaIssueDate: daysAgo(21),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-quarry-fragment-2",
      },
    ]),
    statusHistory: history(["draft", 21], ["pending_approval", 14]),
  },

  // --- Still drafts: never submitted, so they never reach the queue --------
  {
    id: "river-stone-triptych",
    title: "River Stone Triptych",
    artistId: "meera-nair",
    ...artistMeta("meera-nair"),
    category: "painting",
    medium: "Oil on Canvas",
    customerPrice: 39800,
    thumbnailUrl: IMG.idPaint,
    insured: true,
    status: "draft",
    listingType: "marketplace_only",
    description:
      "Three panels painted as one continuous view of a drying riverbed, intended to hang with a hand's width between them so the gap reads as part of the composition. Still in progress: the third panel's foreground has been reworked twice and Meera has not yet signed the set.",
    dimensions: "3 panels, 18x24 in each",
    yearCreated: 2026,
    images: images("River Stone Triptych", [
      IMG.idPaint,
      IMG.landscape,
      IMG.framed,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0028",
    coaIssueDate: daysAgo(3),
    socialProofLinks: social([]),
    statusHistory: history(["draft", 3]),
  },
  {
    id: "warp-and-weft-no-4",
    title: "Warp and Weft No. 4",
    artistId: "ananya-deshmukh",
    ...artistMeta("ananya-deshmukh"),
    category: "textile art",
    medium: "Hand Embroidery on Cotton, Natural Dye",
    customerPrice: 9900,
    thumbnailUrl: IMG.drape,
    insured: false,
    status: "draft",
    listingType: "marketplace_only",
    description:
      "A small study working the border stitch her grandmother taught her into a grid rather than an edge, dyed with marigold and pomegranate rind from the family kitchen garden. Photographed but not yet submitted. Ananya is waiting to finish the matching second panel.",
    dimensions: "14x18 in",
    yearCreated: 2026,
    images: images("Warp and Weft No. 4", [IMG.drape, IMG.eco3, IMG.journey]),
    coaCertificateNumber: "GZ-COA-2026-0029",
    coaIssueDate: daysAgo(1),
    socialProofLinks: social([]),
    statusHistory: history(["draft", 1]),
  },

  // --- Returned: one rejected at review, one delisted after listing -------
  {
    id: "chromatic-drift-study",
    title: "Chromatic Drift Study",
    artistId: "ishaan-kapoor",
    ...artistMeta("ishaan-kapoor"),
    category: "painting",
    medium: "Acrylic on Canvas",
    customerPrice: 22400,
    thumbnailUrl: IMG.framed,
    insured: true,
    status: "returned",
    listingType: "marketplace_only",
    description:
      "A smaller companion study to Ishaan's stairwell series, worked in a narrower palette across four sessions. Returned to the artist after review for re-photography. The submitted images were shot under mixed lighting and did not show the surface accurately.",
    dimensions: "20x24 in",
    yearCreated: 2026,
    images: images("Chromatic Drift Study", [
      IMG.framed,
      IMG.eco2,
      IMG.landscape,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0030",
    coaIssueDate: daysAgo(12),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-chromatic-drift",
      },
    ]),
    statusHistory: history(
      ["draft", 12],
      ["pending_approval", 9],
      ["returned", 5],
    ),
  },
  {
    id: "paper-lantern-series-i",
    title: "Paper Lantern Series I",
    artistId: "rohan-bhattacharya",
    ...artistMeta("rohan-bhattacharya"),
    category: "printmaking",
    medium: "Linocut on Paper",
    customerPrice: 12600,
    thumbnailUrl: IMG.busts,
    insured: false,
    status: "returned",
    listingType: "marketplace_only",
    description:
      "A two-colour linocut of paper lanterns strung across a Kalighat lane, hand-cut and printed in two registered passes on a proofing press. Delisted at the artist's request while he reworks the second colour block; the edition will be re-submitted once the new pulls are complete.",
    dimensions: "12x16 in",
    yearCreated: 2025,
    images: images("Paper Lantern Series I", [
      IMG.busts,
      IMG.pyramid,
      IMG.eco1,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0031",
    coaIssueDate: daysAgo(74),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-paper-lantern-1/",
      },
    ]),
    statusHistory: history(
      ["draft", 74],
      ["pending_approval", 70],
      ["marketplace", 64],
      ["returned", 26],
    ),
  },
];

// ---------------------------------------------------------------------------
// Users.
//
// The seven public ArtistProfiles are mapped (not hand-duplicated) into
// AdminUser rows so the admin Artists table shows exactly the people the
// public site shows and the two can never drift; only the admin-only fields
// (account status, KYC state, join/last-login dates) are authored here, keyed
// by artist id. The same applies to mockCustomer, whose orders and addresses
// are the only ones the customer fixtures contain.
//
// 15 further users are admin-only, spanning artists / aggregators /
// customers with mixed account status. Five artists sit in submitted or
// under_review KYC so the KYC queue has real work waiting.
// ---------------------------------------------------------------------------

interface ArtistAdminMeta {
  status: UserStatus;
  kycStatus: KycStatus;
  joinedDaysAgo: number;
  lastLoginDaysAgo: number;
}

const ARTIST_ADMIN_META: Record<string, ArtistAdminMeta> = {
  "meera-nair": {
    status: "active",
    kycStatus: "approved",
    joinedDaysAgo: 340,
    lastLoginDaysAgo: 1,
  },
  "arjun-mehta": {
    status: "active",
    kycStatus: "approved",
    joinedDaysAgo: 322,
    lastLoginDaysAgo: 2,
  },
  // Tier-1 only and still mid-review — this is one of the KYC queue's rows.
  "kavya-iyer": {
    status: "active",
    kycStatus: "under_review",
    joinedDaysAgo: 58,
    lastLoginDaysAgo: 0,
  },
  "rohan-bhattacharya": {
    status: "active",
    kycStatus: "approved",
    joinedDaysAgo: 128,
    lastLoginDaysAgo: 4,
  },
  // Zero tiers, joined this month — matches her public bio exactly.
  "ananya-deshmukh": {
    status: "active",
    kycStatus: "submitted",
    joinedDaysAgo: 26,
    lastLoginDaysAgo: 1,
  },
  "ishaan-kapoor": {
    status: "active",
    kycStatus: "approved",
    joinedDaysAgo: 190,
    lastLoginDaysAgo: 6,
  },
  "priya-subramaniam": {
    status: "active",
    kycStatus: "approved",
    joinedDaysAgo: 214,
    lastLoginDaysAgo: 9,
  },
};

const derivedArtistUsers: AdminUser[] = mockArtists.map((artist, i) => {
  const meta = ARTIST_ADMIN_META[artist.id];
  if (!meta)
    throw new Error(
      `mock-data/admin: no admin metadata for artist "${artist.id}"`,
    );
  return {
    id: `user-${artist.id}`,
    name: artist.name,
    email: `${artist.id.replace(/-/g, ".")}@example.com`,
    phone: `+9198${76543210 + i * 1111}`,
    role: "artist",
    status: meta.status,
    createdAt: daysAgo(meta.joinedDaysAgo),
    lastLoginAt: daysAgo(meta.lastLoginDaysAgo),
    kycStatus: meta.kycStatus,
  };
});

const derivedCustomerUser: AdminUser = {
  id: "user-customer-aarav-shah",
  name: mockCustomer.name,
  email: mockCustomer.email,
  phone: mockCustomer.phone,
  role: "customer",
  status: "active",
  createdAt: daysAgo(240),
  lastLoginAt: daysAgo(0),
};

const adminOnlyUsers: AdminUser[] = [
  // --- Artists ----------------------------------------------------------
  {
    id: "user-artist-nikhil-raut",
    name: "Nikhil Raut",
    email: "nikhil.raut@example.com",
    phone: "+919845112230",
    role: "artist",
    status: "pending",
    createdAt: daysAgo(9),
    lastLoginAt: daysAgo(2),
    kycStatus: "submitted",
  },
  {
    id: "user-artist-farah-qureshi",
    name: "Farah Qureshi",
    email: "farah.qureshi@example.com",
    phone: "+919845112241",
    role: "artist",
    status: "active",
    createdAt: daysAgo(34),
    lastLoginAt: daysAgo(1),
    kycStatus: "under_review",
  },
  {
    // The same artist the Artist Dashboard is signed in as
    // (features/dashboard/dashboard-data.ts's ARTIST), so she resolves in
    // admin too. Not imported from there: that module pulls in lucide-react
    // icons, which has no business inside a fixture file.
    id: "user-artist-devika-rao",
    name: "Devika Rao",
    email: "devika.rao@example.com",
    phone: "+919845112252",
    role: "artist",
    status: "active",
    createdAt: daysAgo(168),
    lastLoginAt: daysAgo(0),
    kycStatus: "approved",
  },
  {
    id: "user-artist-sameer-joshi",
    name: "Sameer Joshi",
    email: "sameer.joshi@example.com",
    phone: "+919845112263",
    role: "artist",
    status: "active",
    createdAt: daysAgo(17),
    lastLoginAt: daysAgo(3),
    kycStatus: "submitted",
  },
  {
    id: "user-artist-lata-menon",
    name: "Lata Menon",
    email: "lata.menon@example.com",
    phone: "+919845112274",
    role: "artist",
    status: "suspended",
    createdAt: daysAgo(96),
    lastLoginAt: daysAgo(27),
    kycStatus: "rejected",
  },
  {
    id: "user-artist-tenzin-norbu",
    name: "Tenzin Norbu",
    email: "tenzin.norbu@example.com",
    phone: "+919845112285",
    role: "artist",
    status: "pending",
    createdAt: daysAgo(4),
    lastLoginAt: daysAgo(0),
    kycStatus: "pending",
  },

  // --- Aggregators ------------------------------------------------------
  {
    // Mapped from features/aggregator/aggregator-data.ts so the company the
    // Aggregator Portal is signed in as is the same row admin sees.
    id: "user-agg-verandah",
    name: AGGREGATOR.contactPerson,
    email: "meher@verandaharthouse.in",
    phone: "+919830045512",
    role: "aggregator",
    status: "active",
    createdAt: daysAgo(288),
    lastLoginAt: daysAgo(0),
    companyName: AGGREGATOR.companyName,
  },
  {
    id: "user-agg-kala-collective",
    name: "Rukmini Sen",
    email: "rukmini@kalacollective.in",
    phone: "+919830045523",
    role: "aggregator",
    status: "active",
    createdAt: daysAgo(205),
    lastLoginAt: daysAgo(3),
    companyName: "Kala Collective",
  },
  {
    id: "user-agg-fort-kochi",
    name: "Anil Varghese",
    email: "anil@fortkochiartrooms.in",
    phone: "+919830045534",
    role: "aggregator",
    status: "active",
    createdAt: daysAgo(141),
    lastLoginAt: daysAgo(8),
    companyName: "Fort Kochi Art Rooms",
  },
  {
    id: "user-agg-baithak",
    name: "Zoya Hussain",
    email: "zoya@baithakgallery.in",
    phone: "+919830045545",
    role: "aggregator",
    status: "suspended",
    createdAt: daysAgo(77),
    lastLoginAt: daysAgo(40),
    companyName: "Baithak Gallery",
  },

  // --- Customers --------------------------------------------------------
  {
    id: "user-customer-neha-pillai",
    name: "Neha Pillai",
    email: "neha.pillai@example.com",
    phone: "+919920334410",
    role: "customer",
    status: "active",
    createdAt: daysAgo(176),
    lastLoginAt: daysAgo(5),
  },
  {
    id: "user-customer-vikram-desai",
    name: "Vikram Desai",
    email: "vikram.desai@example.com",
    phone: "+919920334421",
    role: "customer",
    status: "active",
    createdAt: daysAgo(121),
    lastLoginAt: daysAgo(2),
  },
  {
    id: "user-customer-shreya-banerjee",
    name: "Shreya Banerjee",
    email: "shreya.banerjee@example.com",
    phone: "+919920334432",
    role: "customer",
    status: "active",
    createdAt: daysAgo(88),
    lastLoginAt: daysAgo(12),
  },
  {
    id: "user-customer-imran-shaikh",
    name: "Imran Shaikh",
    email: "imran.shaikh@example.com",
    phone: "+919920334443",
    role: "customer",
    status: "blocked",
    createdAt: daysAgo(63),
    lastLoginAt: daysAgo(44),
  },
  {
    id: "user-customer-tara-mathew",
    name: "Tara Mathew",
    email: "tara.mathew@example.com",
    phone: "+919920334454",
    role: "customer",
    status: "pending",
    createdAt: daysAgo(3),
    lastLoginAt: daysAgo(1),
  },
];

export const mockAdminUsers: AdminUser[] = [
  ...derivedArtistUsers,
  ...adminOnlyUsers,
  derivedCustomerUser,
];

// The KYC queue definition lives here rather than being re-derived at three
// call sites, so the queue table, the moderation nav badge and the KPI tile
// can never disagree about what "pending KYC" means.
export const KYC_QUEUE_STATUSES: KycStatus[] = ["submitted", "under_review"];

export function isInKycQueue(user: AdminUser): boolean {
  return (
    user.role === "artist" &&
    !!user.kycStatus &&
    KYC_QUEUE_STATUSES.includes(user.kycStatus)
  );
}

// ---------------------------------------------------------------------------
// Withdrawal requests. Every amount clears the documented ₹1,000 minimum and
// every bank reference is masked to its last four digits — a full account
// number never appears in a fixture, let alone in the UI. wd-1003 requests
// more than the wallet holds on purpose: the review dialog has to flag that
// case, so the fixture has to contain it.
// ---------------------------------------------------------------------------

interface WithdrawalSeed {
  id: string;
  userId: string;
  amount: number;
  bankAccountMasked: string;
  walletBalance: number;
  status: WithdrawalStatus;
  requestedDaysAgo: number;
  processedDaysAgo: number | null;
}

const WITHDRAWAL_SEEDS: WithdrawalSeed[] = [
  {
    id: "wd-1001",
    userId: "user-meera-nair",
    amount: 42500,
    bankAccountMasked: "XXXXXXXX4417",
    walletBalance: 58300,
    status: "pending",
    requestedDaysAgo: 2,
    processedDaysAgo: null,
  },
  {
    id: "wd-1002",
    userId: "user-arjun-mehta",
    amount: 96000,
    bankAccountMasked: "XXXXXXXX8820",
    walletBalance: 96000,
    status: "pending",
    requestedDaysAgo: 4,
    processedDaysAgo: null,
  },
  {
    id: "wd-1003",
    userId: "user-agg-verandah",
    amount: 31200,
    bankAccountMasked: "XXXXXXXX1174",
    walletBalance: 27600,
    status: "pending",
    requestedDaysAgo: 1,
    processedDaysAgo: null,
  },
  {
    id: "wd-1004",
    userId: "user-artist-devika-rao",
    amount: 12800,
    bankAccountMasked: "XXXXXXXX6903",
    walletBalance: 21450,
    status: "pending",
    requestedDaysAgo: 6,
    processedDaysAgo: null,
  },
  {
    id: "wd-1005",
    userId: "user-priya-subramaniam",
    amount: 64300,
    bankAccountMasked: "XXXXXXXX3355",
    walletBalance: 71900,
    status: "completed",
    requestedDaysAgo: 19,
    processedDaysAgo: 17,
  },
  {
    id: "wd-1006",
    userId: "user-agg-kala-collective",
    amount: 24000,
    bankAccountMasked: "XXXXXXXX7742",
    walletBalance: 48150,
    status: "completed",
    requestedDaysAgo: 31,
    processedDaysAgo: 29,
  },
  {
    id: "wd-1007",
    userId: "user-ishaan-kapoor",
    amount: 18600,
    bankAccountMasked: "XXXXXXXX2098",
    walletBalance: 26700,
    status: "completed",
    requestedDaysAgo: 45,
    processedDaysAgo: 44,
  },
  {
    id: "wd-1008",
    userId: "user-artist-lata-menon",
    amount: 5000,
    bankAccountMasked: "XXXXXXXX9061",
    walletBalance: 5000,
    status: "rejected",
    requestedDaysAgo: 22,
    processedDaysAgo: 20,
  },
  {
    id: "wd-1009",
    userId: "user-rohan-bhattacharya",
    amount: 9400,
    bankAccountMasked: "XXXXXXXX5527",
    walletBalance: 14200,
    status: "rejected",
    requestedDaysAgo: 12,
    processedDaysAgo: 11,
  },
  {
    id: "wd-1010",
    userId: "user-agg-fort-kochi",
    amount: 52000,
    bankAccountMasked: "XXXXXXXX4183",
    walletBalance: 61300,
    status: "failed",
    requestedDaysAgo: 8,
    processedDaysAgo: 7,
  },
];

export const mockWithdrawals: WithdrawalRequest[] = WITHDRAWAL_SEEDS.map(
  (seed) => {
    const user = mockAdminUsers.find((u) => u.id === seed.userId);
    if (!user)
      throw new Error(
        `mock-data/admin: withdrawal "${seed.id}" references unknown user "${seed.userId}"`,
      );
    if (user.role !== "artist" && user.role !== "aggregator") {
      throw new Error(
        `mock-data/admin: withdrawal "${seed.id}" requester must be an artist or aggregator`,
      );
    }
    return {
      id: seed.id,
      userId: user.id,
      userName:
        user.role === "aggregator"
          ? (user.companyName ?? user.name)
          : user.name,
      userRole: user.role,
      amount: seed.amount,
      bankAccountMasked: seed.bankAccountMasked,
      walletBalance: seed.walletBalance,
      status: seed.status,
      requestedAt: daysAgo(seed.requestedDaysAgo),
      processedAt:
        seed.processedDaysAgo === null ? null : daysAgo(seed.processedDaysAgo),
    };
  },
);

// ---------------------------------------------------------------------------
// Settlements. The three components are never authored by hand — they are
// derived from the order total using the documented platform formula (the
// customer price is the artist's price + 30%; an aggregator-mediated sale
// takes 20% of that markup), with rounding absorbed by the platform's share
// so artistAmount + aggregatorCommission + platformRevenue reconciles to the
// order total exactly. The same formula drives the revenue chart in
// admin-analytics.ts, so the settlements table and the analytics page cannot
// disagree about where a rupee went.
//
// Four rows reference real mockOrders ids and take that order's own amount.
// The remaining eight are sales by buyers outside the single-customer
// mockOrders sample and carry their artwork's customer price instead; they
// are deliberately NOT linkable to an order detail page.
// ---------------------------------------------------------------------------

interface SettlementSeed {
  id: string;
  orderId: string;
  artworkId: string;
  status: SettlementStatus;
  createdDaysAgo: number;
  processedDaysAgo: number | null;
}

const SETTLEMENT_SEEDS: SettlementSeed[] = [
  {
    id: "stl-4001",
    orderId: "order-monsoon-madurai",
    artworkId: "monsoon-over-madurai",
    status: "processed",
    createdDaysAgo: 11,
    processedDaysAgo: 9,
  },
  {
    id: "stl-4002",
    orderId: "order-backwater-light",
    artworkId: "backwater-light-early-hours",
    status: "pending",
    createdDaysAgo: 1,
    processedDaysAgo: null,
  },
  {
    id: "stl-4003",
    orderId: "order-tide-line-dusk",
    artworkId: "tide-line-dusk",
    status: "pending",
    createdDaysAgo: 1,
    processedDaysAgo: null,
  },
  {
    id: "stl-4004",
    orderId: "order-ancestral-bronze",
    artworkId: "ancestral-bronze-study",
    status: "pending",
    createdDaysAgo: 1,
    processedDaysAgo: null,
  },
  {
    id: "stl-4005",
    orderId: "order-gz-2610",
    artworkId: "salvaged-frequencies",
    status: "processed",
    createdDaysAgo: 9,
    processedDaysAgo: 6,
  },
  {
    id: "stl-4006",
    orderId: "order-gz-2604",
    artworkId: "rust-and-ochre-wall-piece",
    status: "processed",
    createdDaysAgo: 24,
    processedDaysAgo: 22,
  },
  {
    id: "stl-4007",
    orderId: "order-gz-2597",
    artworkId: "concrete-bloom",
    status: "processed",
    createdDaysAgo: 33,
    processedDaysAgo: 31,
  },
  {
    id: "stl-4008",
    orderId: "order-gz-2588",
    artworkId: "fractured-skyline",
    status: "processed",
    createdDaysAgo: 47,
    processedDaysAgo: 45,
  },
  {
    id: "stl-4009",
    orderId: "order-gz-2571",
    artworkId: "howrah-line-evening",
    status: "processed",
    createdDaysAgo: 52,
    processedDaysAgo: 50,
  },
  {
    id: "stl-4010",
    orderId: "order-gz-2559",
    artworkId: "last-show-at-metro-talkies",
    status: "failed",
    createdDaysAgo: 16,
    processedDaysAgo: 14,
  },
  {
    id: "stl-4011",
    orderId: "order-gz-2544",
    artworkId: "field-of-kusum-dye",
    status: "processed",
    createdDaysAgo: 8,
    processedDaysAgo: 5,
  },
  {
    id: "stl-4012",
    orderId: "order-gz-2531",
    artworkId: "ghat-steps-no-7",
    status: "failed",
    createdDaysAgo: 39,
    processedDaysAgo: 37,
  },
];

// Exported so Task 15's detail drawer can show the same reconciliation the
// fixture was built from instead of re-deriving it slightly differently.
export function splitSettlement(
  orderTotal: number,
  viaAggregator: boolean,
): {
  artistAmount: number;
  aggregatorCommission: number;
  platformRevenue: number;
} {
  const artistAmount = Math.round(orderTotal / 1.3);
  const markup = orderTotal - artistAmount;
  const aggregatorCommission = viaAggregator ? Math.round(markup * 0.2) : 0;
  return {
    artistAmount,
    aggregatorCommission,
    platformRevenue: markup - aggregatorCommission,
  };
}

export const mockSettlements: Settlement[] = SETTLEMENT_SEEDS.map((seed) => {
  const artwork = mockArtworks.find((a) => a.id === seed.artworkId);
  if (!artwork) {
    throw new Error(
      `mock-data/admin: settlement "${seed.id}" references unknown artwork "${seed.artworkId}"`,
    );
  }
  const order = mockOrders.find((o) => o.id === seed.orderId);
  const orderTotal = order ? order.amount : artwork.customerPrice;
  const split = splitSettlement(
    orderTotal,
    artwork.listingType === "marketplace_and_aggregator",
  );
  return {
    id: seed.id,
    orderId: seed.orderId,
    artworkTitle: artwork.title,
    artistName: artwork.artistName,
    ...split,
    status: seed.status,
    createdAt: daysAgo(seed.createdDaysAgo),
    processedAt:
      seed.processedDaysAgo === null ? null : daysAgo(seed.processedDaysAgo),
  };
});

// ---------------------------------------------------------------------------
// Categories. Counts are computed from the artworks that actually exist —
// public plus admin-only — because /admin/artworks lists both, so a hardcoded
// count would contradict the row count you get by filtering that table.
// `slug` is the category value with spaces replaced by hyphens, so
// artworkCategoryFromSlug() below round-trips it back to the raw value stored
// on Artwork.category.
// ---------------------------------------------------------------------------

const allArtworksForCounts = [...mockArtworks, ...mockPendingArtworks];

function toSlug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function artworkCategoryFromSlug(slug: string): string {
  return slug.replace(/-/g, " ");
}

const categoryCounts = new Map<string, number>();
for (const artwork of allArtworksForCounts) {
  categoryCounts.set(
    artwork.category,
    (categoryCounts.get(artwork.category) ?? 0) + 1,
  );
}

export const mockCategories: Category[] = [
  ...Array.from(categoryCounts.entries())
    .map(([value, count]) => ({
      id: `cat-${toSlug(value)}`,
      name: toTitleCase(value),
      slug: toSlug(value),
      artworkCount: count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name)),
  // Seeded with nothing in it on purpose: the delete guard is only
  // demonstrable if at least one category is actually deletable.
  { id: "cat-ceramics", name: "Ceramics", slug: "ceramics", artworkCount: 0 },
];

// ---------------------------------------------------------------------------
// Seeded audit history, so /admin/audit-logs is never empty before you act.
// Live session actions are appended on top by store/useAdminAuditStore.
//
// Every entityId resolves to something real (asserted at the bottom of this
// file) and every timestamp matches the event it records: an
// "artwork.approved" row carries the exact date of that artwork's
// pending_approval → marketplace transition, and a "withdrawal.approved" row
// carries that withdrawal's processedAt. Newest first.
// ---------------------------------------------------------------------------

export const mockAuditLog: AuditLogEntry[] = [
  {
    id: "audit-0001",
    adminName: "Sneha Kulkarni",
    action: "artwork.rejected",
    entityType: "artwork",
    entityId: "chromatic-drift-study",
    entityLabel: "Chromatic Drift Study",
    detail:
      "Images shot under mixed lighting. Surface not accurately represented. Re-photograph and resubmit.",
    createdAt: daysAgo(5),
  },
  {
    id: "audit-0002",
    adminName: "Ops Console",
    action: "artwork.approved",
    entityType: "artwork",
    entityId: "grandmothers-stitch-revisited",
    entityLabel: "Grandmother's Stitch, Revisited",
    createdAt: daysAgo(6),
  },
  {
    id: "audit-0003",
    adminName: "Rahul Verma",
    action: "settings.updated",
    entityType: "settings",
    entityId: "platform-settings",
    entityLabel: "Platform settings",
    detail: "Insurance-recommended threshold reviewed and confirmed unchanged.",
    createdAt: daysAgo(7),
  },
  {
    id: "audit-0004",
    adminName: "Ops Console",
    action: "artwork.approved",
    entityType: "artwork",
    entityId: "field-of-kusum-dye",
    entityLabel: "Field of Kusum Dye",
    createdAt: daysAgo(10),
  },
  {
    id: "audit-0005",
    adminName: "Rahul Verma",
    action: "withdrawal.rejected",
    entityType: "withdrawal",
    entityId: "wd-1009",
    entityLabel: "Payout request: Rohan Bhattacharya",
    detail: "Bank account name does not match the registered artist name.",
    createdAt: daysAgo(11),
  },
  {
    id: "audit-0006",
    adminName: "Sneha Kulkarni",
    action: "category.created",
    entityType: "category",
    entityId: "cat-ceramics",
    entityLabel: "Ceramics",
    detail: "Added ahead of the ceramics cohort onboarding.",
    createdAt: daysAgo(15),
  },
  {
    id: "audit-0007",
    adminName: "Rahul Verma",
    action: "withdrawal.approved",
    entityType: "withdrawal",
    entityId: "wd-1005",
    entityLabel: "Payout request: Priya Subramaniam",
    createdAt: daysAgo(17),
  },
  {
    id: "audit-0008",
    adminName: "Ops Console",
    action: "user.suspended",
    entityType: "user",
    entityId: "user-agg-baithak",
    entityLabel: "Baithak Gallery",
    detail:
      "Repeated failure to return unsold consignments within the 30-day window.",
    createdAt: daysAgo(18),
  },
  {
    id: "audit-0009",
    adminName: "Ops Console",
    action: "artwork.approved",
    entityType: "artwork",
    entityId: "balcony-seats-empty-reel",
    entityLabel: "Balcony Seats, Empty Reel",
    createdAt: daysAgo(20),
  },
  {
    id: "audit-0010",
    adminName: "Rahul Verma",
    action: "withdrawal.rejected",
    entityType: "withdrawal",
    entityId: "wd-1008",
    entityLabel: "Payout request: Lata Menon",
    detail: "Account suspended pending KYC re-submission.",
    createdAt: daysAgo(20),
  },
  {
    id: "audit-0011",
    adminName: "Sneha Kulkarni",
    action: "artwork.delisted",
    entityType: "artwork",
    entityId: "paper-lantern-series-i",
    entityLabel: "Paper Lantern Series I",
    detail:
      "Delisted at the artist's request while the second colour block is reworked.",
    createdAt: daysAgo(26),
  },
  {
    id: "audit-0012",
    adminName: "Rahul Verma",
    action: "withdrawal.approved",
    entityType: "withdrawal",
    entityId: "wd-1006",
    entityLabel: "Payout request: Kala Collective",
    createdAt: daysAgo(29),
  },
  {
    id: "audit-0013",
    adminName: "Sneha Kulkarni",
    action: "kyc.rejected",
    entityType: "user",
    entityId: "user-artist-lata-menon",
    entityLabel: "Lata Menon",
    detail: "Submitted document was illegible; re-submission requested.",
    createdAt: daysAgo(29),
  },
  {
    id: "audit-0014",
    adminName: "Ops Console",
    action: "artwork.approved",
    entityType: "artwork",
    entityId: "last-show-at-metro-talkies",
    entityLabel: "Last Show at Metro Talkies",
    createdAt: daysAgo(30),
  },
  {
    id: "audit-0015",
    adminName: "Ops Console",
    action: "artwork.approved",
    entityType: "artwork",
    entityId: "rust-and-ochre-wall-piece",
    entityLabel: "Rust and Ochre Wall Piece",
    createdAt: daysAgo(32),
  },
  {
    id: "audit-0016",
    adminName: "Sneha Kulkarni",
    action: "kyc.approved",
    entityType: "user",
    entityId: "user-artist-devika-rao",
    entityLabel: "Devika Rao",
    createdAt: daysAgo(34),
  },
  {
    id: "audit-0017",
    adminName: "Ops Console",
    action: "artwork.approved",
    entityType: "artwork",
    entityId: "college-street-folio",
    entityLabel: "College Street Folio",
    createdAt: daysAgo(38),
  },
  {
    id: "audit-0018",
    adminName: "Sneha Kulkarni",
    action: "kyc.approved",
    entityType: "user",
    entityId: "user-rohan-bhattacharya",
    entityLabel: "Rohan Bhattacharya",
    createdAt: daysAgo(41),
  },
  {
    id: "audit-0019",
    adminName: "Ops Console",
    action: "user.activated",
    entityType: "user",
    entityId: "user-customer-vikram-desai",
    entityLabel: "Vikram Desai",
    detail: "Payment dispute resolved; account restored.",
    createdAt: daysAgo(44),
  },
  {
    id: "audit-0020",
    adminName: "Ops Console",
    action: "artwork.approved",
    entityType: "artwork",
    entityId: "reclaimed-stone-vessel",
    entityLabel: "Reclaimed Stone Vessel",
    createdAt: daysAgo(47),
  },
];

// ---------------------------------------------------------------------------
// Previously generated reports (/admin/reports). The download affordance is
// necessarily inert in a mock build — Task 16 must label it honestly.
// ---------------------------------------------------------------------------

export const mockReports: GeneratedReport[] = [
  {
    id: "rpt-0104",
    type: "sales",
    label: "Marketplace sales (July 2026)",
    from: "2026-07-01T00:00:00.000Z",
    to: "2026-07-31T00:00:00.000Z",
    generatedAt: daysAgo(11),
    generatedBy: "Ops Console",
    rowCount: 58,
    status: "ready",
  },
  {
    id: "rpt-0103",
    type: "artist_payouts",
    label: "Artist payouts (H1 2026)",
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-06-30T00:00:00.000Z",
    generatedAt: daysAgo(26),
    generatedBy: "Ops Console",
    rowCount: 244,
    status: "ready",
  },
  {
    id: "rpt-0102",
    type: "settlements",
    label: "Settlement register (Apr–Jun 2026)",
    from: "2026-04-01T00:00:00.000Z",
    to: "2026-06-30T00:00:00.000Z",
    generatedAt: daysAgo(38),
    generatedBy: "Rahul Verma",
    rowCount: 140,
    status: "ready",
  },
  {
    id: "rpt-0101",
    type: "gst",
    label: "GST summary (June 2026)",
    from: "2026-06-01T00:00:00.000Z",
    to: "2026-06-30T00:00:00.000Z",
    generatedAt: daysAgo(41),
    generatedBy: "Sneha Kulkarni",
    rowCount: 52,
    status: "ready",
  },
];

// ---------------------------------------------------------------------------
// Platform configuration. These are the real documented values (Onboarding
// Guide / SAD), not invented ones: 30% markup, 5% GST, ₹1,000 minimum
// withdrawal, ₹20,000 insurance-recommended threshold, and the aggregator's
// 20% share of the markup.
// ---------------------------------------------------------------------------

export const defaultPlatformSettings: PlatformSettings = {
  markupPercent: 30,
  gstPercent: 5,
  minWithdrawalAmount: 1000,
  insuranceThreshold: 20000,
  aggregatorCommissionPercent: 20,
};

// ---------------------------------------------------------------------------
// Overview KPIs.
//
// The three pending counts, activeArtworks and totalUsers are COMPUTED from
// the fixtures above, never hardcoded, so every tile agrees with the queue or
// table it links to — the whole point of a moderation KPI is that clicking it
// shows you exactly that many rows.
//
// gmv / platformRevenue / artistPayouts / totalOrders are summed from the
// 12-month analytics series instead, so the Overview and the Analytics page
// report the same lifetime figures to the rupee. Those four are platform
// aggregates and are deliberately larger than the seeded order sample: as
// admin-analytics.ts's header explains, deriving trend charts from real
// orders would have required hundreds of fabricated order rows, which was
// rejected. The Orders table is a six-row sample of one customer's
// purchases, not the platform's ledger.
// ---------------------------------------------------------------------------

const total12mGmv = revenueSeries["12m"].reduce(
  (sum, point) => sum + point.gmv,
  0,
);
const total12mPlatform = revenueSeries["12m"].reduce(
  (sum, point) => sum + point.platform,
  0,
);
const total12mArtist = revenueSeries["12m"].reduce(
  (sum, point) => sum + point.artist,
  0,
);
const total12mOrders = volumeSeries["12m"].reduce(
  (sum, point) => sum + point.orders,
  0,
);

export const mockAdminKpis: AdminKpis = {
  gmv: total12mGmv,
  platformRevenue: total12mPlatform,
  artistPayouts: total12mArtist,
  totalOrders: total12mOrders,
  activeArtworks: allArtworksForCounts.filter(
    (artwork) => artwork.status === "marketplace",
  ).length,
  totalUsers: mockAdminUsers.length,
  pendingArtworkApprovals: mockPendingArtworks.filter(
    (a) => a.status === "pending_approval",
  ).length,
  pendingKyc: mockAdminUsers.filter(isInKycQueue).length,
  pendingWithdrawals: mockWithdrawals.filter((w) => w.status === "pending")
    .length,
};

// ---------------------------------------------------------------------------
// Recent activity feed. Newest first; every entry describes something that
// actually exists in the fixtures above. Amounts are deliberately absent —
// money is rendered through formatINR at display time, never baked into a
// fixture string.
// ---------------------------------------------------------------------------

export const mockAdminActivity: AdminActivityEvent[] = [
  {
    id: "act-01",
    kind: "artwork",
    label: "Artwork submitted for review",
    detail: "“Salt Flat Nocturne” by Kavya Iyer",
    at: daysAgo(0),
  },
  {
    id: "act-02",
    kind: "order",
    label: "New order placed",
    detail: "Carved Marble Torso · Aarav Shah",
    at: daysAgo(0),
  },
  {
    id: "act-03",
    kind: "order",
    label: "Payment confirmed",
    detail: "Ancestral Bronze Study · Aarav Shah",
    at: daysAgo(1),
  },
  {
    id: "act-04",
    kind: "withdrawal",
    label: "Payout requested",
    detail: "Verandah Art House · exceeds available balance",
    at: daysAgo(1),
  },
  {
    id: "act-05",
    kind: "artwork",
    label: "Artwork submitted for review",
    detail: "“Wildfire Sutra” by Ishaan Kapoor",
    at: daysAgo(1),
  },
  {
    id: "act-06",
    kind: "order",
    label: "Order confirmed",
    detail: "Tide Line, Dusk · Aarav Shah",
    at: daysAgo(2),
  },
  {
    id: "act-07",
    kind: "withdrawal",
    label: "Payout requested",
    detail: "Meera Nair · artist wallet",
    at: daysAgo(2),
  },
  {
    id: "act-08",
    kind: "user",
    label: "New collector registered",
    detail: "Tara Mathew",
    at: daysAgo(3),
  },
  {
    id: "act-09",
    kind: "user",
    label: "New artist registered",
    detail: "Tenzin Norbu · verification not started",
    at: daysAgo(4),
  },
  {
    id: "act-10",
    kind: "artwork",
    label: "Artwork returned to artist",
    detail: "“Chromatic Drift Study” · rejected at review",
    at: daysAgo(5),
  },
  {
    id: "act-11",
    kind: "settlement",
    label: "Settlement processed",
    detail: "Salvaged Frequencies · Priya Subramaniam",
    at: daysAgo(6),
  },
];

// ---------------------------------------------------------------------------
// Self-checks — fail fast at import time rather than let four downstream
// tracks render numbers that quietly contradict each other. Same idiom as
// lib/mock-data/aggregator-holdings.ts. This file is the only one that can
// see both the fixtures and the analytics series, so the cross-file
// assertions live here.
// ---------------------------------------------------------------------------

const artworkIds = new Set<string>();
for (const artwork of allArtworksForCounts) {
  if (artworkIds.has(artwork.id)) {
    throw new Error(
      `mock-data/admin: duplicate artwork id "${artwork.id}" across the public and admin sets`,
    );
  }
  artworkIds.add(artwork.id);
  if (artwork.images.length < 3 || artwork.images.length > 8) {
    throw new Error(
      `mock-data/admin: artwork "${artwork.id}" must carry 3-8 images`,
    );
  }
}

const userIds = new Set(mockAdminUsers.map((u) => u.id));
if (userIds.size !== mockAdminUsers.length) {
  throw new Error("mock-data/admin: duplicate user id in mockAdminUsers");
}

for (const withdrawal of mockWithdrawals) {
  if (withdrawal.amount < defaultPlatformSettings.minWithdrawalAmount) {
    throw new Error(
      `mock-data/admin: withdrawal "${withdrawal.id}" is below the platform minimum`,
    );
  }
  if (!/^X{8}\d{4}$/.test(withdrawal.bankAccountMasked)) {
    throw new Error(
      `mock-data/admin: withdrawal "${withdrawal.id}" bank reference is not masked`,
    );
  }
}

for (const settlement of mockSettlements) {
  const total =
    settlement.artistAmount +
    settlement.aggregatorCommission +
    settlement.platformRevenue;
  const order = mockOrders.find((o) => o.id === settlement.orderId);
  if (order && total !== order.amount) {
    throw new Error(
      `mock-data/admin: settlement "${settlement.id}" (${total}) does not reconcile against order "${order.id}" (${order.amount})`,
    );
  }
  const artwork = mockArtworks.find((a) => a.title === settlement.artworkTitle);
  if (!artwork || artwork.artistName !== settlement.artistName) {
    throw new Error(
      `mock-data/admin: settlement "${settlement.id}" artist does not match its artwork`,
    );
  }
}

const categoryIds = new Set(mockCategories.map((c) => c.id));
for (const entry of mockAuditLog) {
  const resolved =
    (entry.entityType === "artwork" && artworkIds.has(entry.entityId)) ||
    (entry.entityType === "user" && userIds.has(entry.entityId)) ||
    (entry.entityType === "withdrawal" &&
      mockWithdrawals.some((w) => w.id === entry.entityId)) ||
    (entry.entityType === "category" && categoryIds.has(entry.entityId)) ||
    entry.entityType === "settings";
  if (!resolved) {
    throw new Error(
      `mock-data/admin: audit entry "${entry.id}" references missing ${entry.entityType} "${entry.entityId}"`,
    );
  }
}

const roleCounts = {
  artists: mockAdminUsers.filter((u) => u.role === "artist").length,
  aggregators: mockAdminUsers.filter((u) => u.role === "aggregator").length,
  customers: mockAdminUsers.filter((u) => u.role === "customer").length,
};

for (const range of ["30d", "90d", "12m"] as const) {
  const series = userGrowthSeries[range];
  const last = series[series.length - 1];
  if (
    last.artists !== roleCounts.artists ||
    last.aggregators !== roleCounts.aggregators ||
    last.customers !== roleCounts.customers
  ) {
    throw new Error(
      `mock-data/admin: userGrowthSeries["${range}"] does not end on the real per-role counts in mockAdminUsers`,
    );
  }
}

if (
  verificationTiers.reduce((sum, tier) => sum + tier.count, 0) !==
  roleCounts.artists
) {
  throw new Error(
    "mock-data/admin: verificationTiers does not sum to the number of artists in mockAdminUsers",
  );
}

const artistNames = new Set(
  mockAdminUsers.filter((u) => u.role === "artist").map((u) => u.name),
);
for (const performer of topArtists) {
  if (!artistNames.has(performer.name)) {
    throw new Error(
      `mock-data/admin: topArtists entry "${performer.name}" is not a real artist`,
    );
  }
}

const aggregatorNames = new Set(
  mockAdminUsers
    .filter((u) => u.role === "aggregator")
    .map((u) => u.companyName ?? u.name),
);
for (const performer of topAggregators) {
  if (!aggregatorNames.has(performer.name)) {
    throw new Error(
      `mock-data/admin: topAggregators entry "${performer.name}" is not a real aggregator`,
    );
  }
}

if (
  mockCategories.reduce((sum, category) => sum + category.artworkCount, 0) !==
  allArtworksForCounts.length
) {
  throw new Error(
    "mock-data/admin: category artwork counts do not sum to the total number of artworks",
  );
}
