import type {
  Artwork,
  ArtworkImage,
  ArtworkStatus,
  SocialProofLink,
} from "@/types/artwork";
import { verifiedTierCount } from "@/types/artist";
import { mockArtists } from "./artists";

// ---------------------------------------------------------------------------
// 26 artworks across all 7 mockArtists and 6 categories (painting, sculpture,
// photography, printmaking, textile art, mixed media — five or more required).
// customerPrice spans ~₹8,400–₹149,000. Status spread: 20 "marketplace"
// (mostly, per Global Constraints), 5 "reserved", 1 "sold" — every
// "reserved"/"sold" artwork here is tied to a real aggregator holding in
// aggregator-holdings.ts (dates below are kept in exact sync with that file
// via matching day-offsets from the same TODAY anchor), so the two fixtures
// join cleanly by id.
//
// 16 artworks are aggregator-eligible: 14 "marketplace_and_aggregator" and 2
// "aggregator_only" (placed in person, never listed in the online grid). Six
// of those are claimed by a holding, leaving 10 reservable in the Aggregator
// Portal's Inventory view. The remaining 10 are "marketplace_only".
//
// Descriptions never mention price/valuation (platform rule — Onboarding
// Guide "No Price In Description"). artistName/verifiedArtist are derived
// from mockArtists below rather than hand-duplicated, so the two fixtures
// can't drift out of sync.
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
    throw new Error(`mock-data/artworks: unknown artistId "${artistId}"`);
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

export const mockArtworks: Artwork[] = [
  // --- Meera Nair (Gold, painting) ------------------------------------
  {
    id: "monsoon-over-madurai",
    title: "Monsoon Over Madurai",
    artistId: "meera-nair",
    ...artistMeta("meera-nair"),
    category: "painting",
    medium: "Oil on Canvas",
    customerPrice: 23400,
    thumbnailUrl: IMG.landscape,
    insured: true,
    status: "marketplace",
    listingType: "marketplace_only",
    description:
      "Painted over three sittings during the 2025 monsoon, this canvas builds the Madurai coastline in layered oil washes, working wet-into-wet to catch the exact grey-gold light that appears just as the rain breaks. The palette-knife work in the foreground surf is left deliberately raw against the smoother sky. Ships with a signed Certificate of Authenticity and a linked studio video of the final varnishing pass.",
    dimensions: "24x36 in",
    yearCreated: 2025,
    images: images("Monsoon Over Madurai", [
      IMG.landscape,
      IMG.framed,
      IMG.journey,
      IMG.idPaint,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0001",
    coaIssueDate: daysAgo(199),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-monsoon-madurai/",
      },
    ]),
    statusHistory: history(
      ["draft", 210],
      ["pending_approval", 204],
      ["marketplace", 196],
    ),
  },
  {
    id: "backwater-light-early-hours",
    title: "Backwater Light, Early Hours",
    artistId: "meera-nair",
    ...artistMeta("meera-nair"),
    category: "painting",
    medium: "Oil on Canvas",
    customerPrice: 19500,
    thumbnailUrl: IMG.framed,
    insured: false,
    status: "marketplace",
    listingType: "marketplace_only",
    description:
      "A quieter companion to Meera's coastal series, painted at first light on the Kerala backwaters before the water traffic begins. Built in thin, transparent oil glazes over a warm underpainting so the canvas grain shows through in the shadow passages. Unframed and ready to hang, signed and dated on the reverse.",
    dimensions: "20x30 in",
    yearCreated: 2026,
    images: images("Backwater Light, Early Hours", [
      IMG.framed,
      IMG.landscape,
      IMG.eco1,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0002",
    coaIssueDate: daysAgo(141),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-backwater-light",
      },
    ]),
    statusHistory: history(
      ["draft", 150],
      ["pending_approval", 145],
      ["marketplace", 138],
    ),
  },
  {
    id: "tide-line-dusk",
    title: "Tide Line, Dusk",
    artistId: "meera-nair",
    ...artistMeta("meera-nair"),
    category: "painting",
    medium: "Oil on Canvas",
    customerPrice: 27800,
    thumbnailUrl: IMG.idPaint,
    insured: true,
    status: "marketplace",
    listingType: "marketplace_and_aggregator",
    description:
      "One of the earliest paintings in Meera's current coastal body of work, revisiting a stretch of shoreline she has returned to for three years running. The tideline itself is built up in a heavier impasto than the rest of the canvas, marking where land and water meet. Eligible for gallery display through GalleryZone's aggregator network as well as direct marketplace sale.",
    dimensions: "18x24 in",
    yearCreated: 2024,
    images: images("Tide Line, Dusk", [
      IMG.idPaint,
      IMG.landscape,
      IMG.framed,
      IMG.eco2,
      IMG.journey,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0003",
    coaIssueDate: daysAgo(85),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-tide-line-dusk/",
      },
    ]),
    statusHistory: history(
      ["draft", 95],
      ["pending_approval", 90],
      ["marketplace", 82],
    ),
  },

  // --- Arjun Mehta (Gold, sculpture) -----------------------------------
  {
    id: "ancestral-bronze-study",
    title: "Ancestral Bronze Study",
    artistId: "arjun-mehta",
    ...artistMeta("arjun-mehta"),
    category: "sculpture",
    medium: "Cast Bronze",
    customerPrice: 128000,
    thumbnailUrl: IMG.busts,
    insured: true,
    status: "reserved",
    listingType: "marketplace_and_aggregator",
    description:
      "Cast using the lost-wax method in Arjun's family workshop, this study reworks a seated-figure motif that recurs across four generations of his family's carving practice. The bronze is left in its natural patina rather than polished, so the surface will keep shifting tone over years of handling. Currently reserved through a partner aggregator ahead of gallery display.",
    dimensions: "18 in H x 9 in W x 7 in D",
    yearCreated: 2025,
    images: images("Ancestral Bronze Study", [
      IMG.busts,
      IMG.drape,
      IMG.pyramid,
      IMG.eco3,
      IMG.bird,
      IMG.portrait,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0004",
    coaIssueDate: daysAgo(128),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-ancestral-bronze",
      },
    ]),
    statusHistory: history(
      ["draft", 140],
      ["pending_approval", 133],
      ["marketplace", 125],
      ["reserved", 5],
    ),
  },
  {
    id: "carved-marble-torso",
    title: "Carved Marble Torso",
    artistId: "arjun-mehta",
    ...artistMeta("arjun-mehta"),
    category: "sculpture",
    medium: "Carved Marble",
    customerPrice: 149000,
    thumbnailUrl: IMG.drape,
    insured: true,
    status: "marketplace",
    listingType: "marketplace_only",
    description:
      "A single block of Makrana marble, carved entirely by hand over four months with no mechanical finishing on the final surface passes. The torso form continues a study Arjun has returned to several times, each version testing a different balance of rough-cut and polished stone. Base included.",
    dimensions: "22 in H x 10 in W x 8 in D",
    yearCreated: 2023,
    images: images("Carved Marble Torso", [
      IMG.drape,
      IMG.busts,
      IMG.pyramid,
      IMG.eco1,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0005",
    coaIssueDate: daysAgo(284),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-marble-torso/",
      },
    ]),
    statusHistory: history(
      ["draft", 300],
      ["pending_approval", 292],
      ["marketplace", 280],
    ),
  },
  {
    id: "reclaimed-stone-vessel",
    title: "Reclaimed Stone Vessel",
    artistId: "arjun-mehta",
    ...artistMeta("arjun-mehta"),
    category: "sculpture",
    medium: "Reclaimed Sandstone",
    customerPrice: 68500,
    thumbnailUrl: IMG.busts,
    insured: true,
    status: "marketplace",
    listingType: "marketplace_only",
    description:
      "Carved from a single salvaged sandstone block sourced from a demolished haveli near Jaipur, this vessel form keeps the weathering and tool marks of the original stone visible along its base. Arjun finishes each vessel with a hand-rubbed wax seal rather than a synthetic coating, so the surface will darken naturally with handling.",
    dimensions: "14 in H x 12 in diameter",
    yearCreated: 2025,
    images: images("Reclaimed Stone Vessel", [IMG.busts, IMG.drape, IMG.eco2]),
    coaCertificateNumber: "GZ-COA-2026-0006",
    coaIssueDate: daysAgo(50),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-stone-vessel",
      },
    ]),
    statusHistory: history(
      ["draft", 60],
      ["pending_approval", 55],
      ["marketplace", 47],
    ),
  },

  // --- Kavya Iyer (tier1 only, photography) ----------------------------
  {
    id: "last-show-at-metro-talkies",
    title: "Last Show at Metro Talkies",
    artistId: "kavya-iyer",
    ...artistMeta("kavya-iyer"),
    category: "photography",
    medium: "Archival Pigment Print",
    customerPrice: 12800,
    thumbnailUrl: IMG.portrait,
    insured: false,
    status: "marketplace",
    listingType: "marketplace_only",
    description:
      "Shot on medium-format film on the final night Metro Talkies screened a film before closing for good, printed as edition 2 of 9 on archival cotton rag paper. Kavya hand-processes every negative herself and scans at high resolution before printing, so grain and tonal range stay true to the original film stock. Signed and numbered on the reverse.",
    dimensions: "16x20 in",
    yearCreated: 2026,
    images: images("Last Show at Metro Talkies", [
      IMG.portrait,
      IMG.bird,
      IMG.eco3,
      IMG.journey,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0007",
    coaIssueDate: daysAgo(33),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-metro-talkies/",
      },
    ]),
    statusHistory: history(
      ["draft", 40],
      ["pending_approval", 36],
      ["marketplace", 30],
    ),
  },
  {
    id: "balcony-seats-empty-reel",
    title: "Balcony Seats, Empty Reel",
    artistId: "kavya-iyer",
    ...artistMeta("kavya-iyer"),
    category: "photography",
    medium: "Archival Pigment Print",
    customerPrice: 16400,
    thumbnailUrl: IMG.bird,
    insured: true,
    status: "reserved",
    listingType: "marketplace_and_aggregator",
    description:
      "Part of Kavya's ongoing series on Bengaluru's disappearing single-screen cinemas, this print looks down from an empty balcony section onto a projector booth mid reel-change. Edition of 9, printed on archival cotton rag paper from a hand-processed medium-format negative. Currently on reserve for gallery display.",
    dimensions: "20x24 in",
    yearCreated: 2026,
    images: images("Balcony Seats, Empty Reel", [
      IMG.bird,
      IMG.portrait,
      IMG.eco1,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0008",
    coaIssueDate: daysAgo(23),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-balcony-seats/",
      },
      {
        platform: "x",
        url: "https://x.com/kavyaiyerphoto/status/1234567890123456789",
      },
    ]),
    statusHistory: history(
      ["draft", 30],
      ["pending_approval", 25],
      ["marketplace", 20],
      ["reserved", 18],
    ),
  },

  // --- Rohan Bhattacharya (tier1+tier2, printmaking) -------------------
  {
    id: "howrah-line-evening",
    title: "Howrah Line, Evening",
    artistId: "rohan-bhattacharya",
    ...artistMeta("rohan-bhattacharya"),
    category: "printmaking",
    medium: "Linocut on Paper",
    customerPrice: 8400,
    thumbnailUrl: IMG.pyramid,
    insured: false,
    status: "marketplace",
    listingType: "marketplace_only",
    description:
      "A hand-pulled linocut of the evening commuter rush along the Howrah line, cut and printed in a single run of eighteen. Rohan carves each block himself and prints on a hand-cranked proofing press using water-based ink, which keeps the line work crisp without the sheen of oil-based printing. Numbered 6/18.",
    dimensions: "12x16 in",
    yearCreated: 2026,
    images: images("Howrah Line, Evening", [IMG.pyramid, IMG.busts, IMG.eco2]),
    coaCertificateNumber: "GZ-COA-2026-0009",
    coaIssueDate: daysAgo(63),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-howrah-line/",
      },
    ]),
    statusHistory: history(
      ["draft", 70],
      ["pending_approval", 66],
      ["marketplace", 60],
    ),
  },
  {
    id: "ghat-steps-no-7",
    title: "Ghat Steps No. 7",
    artistId: "rohan-bhattacharya",
    ...artistMeta("rohan-bhattacharya"),
    category: "printmaking",
    medium: "Etching on Paper",
    customerPrice: 11600,
    thumbnailUrl: IMG.pyramid,
    insured: false,
    status: "marketplace",
    listingType: "marketplace_and_aggregator",
    description:
      "The seventh in an ongoing series studying the ferry ghats of the Hooghly at different times of day, etched on a copper plate and hand-inked for each pull. This impression uses a heavier plate tone than earlier editions in the series, pushing the steps further into shadow. Eligible for aggregator display alongside its marketplace listing.",
    dimensions: "14x18 in",
    yearCreated: 2025,
    images: images("Ghat Steps No. 7", [
      IMG.pyramid,
      IMG.eco3,
      IMG.busts,
      IMG.journey,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0010",
    coaIssueDate: daysAgo(89),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-ghat-steps",
      },
    ]),
    statusHistory: history(
      ["draft", 100],
      ["pending_approval", 94],
      ["marketplace", 86],
    ),
  },
  {
    id: "college-street-folio",
    title: "College Street Folio",
    artistId: "rohan-bhattacharya",
    ...artistMeta("rohan-bhattacharya"),
    category: "printmaking",
    medium: "Linocut on Paper",
    customerPrice: 14200,
    thumbnailUrl: IMG.busts,
    insured: true,
    status: "reserved",
    listingType: "marketplace_and_aggregator",
    description:
      "A four-colour linocut built from Rohan's sketches of the second-hand book stalls along College Street, printed in four separate registered passes. Each colour block was hand-cut and aligned individually, so slight registration variation between prints in the edition is expected and part of the process. Currently on reserve for gallery display.",
    dimensions: "16x20 in",
    yearCreated: 2026,
    images: images("College Street Folio", [IMG.busts, IMG.pyramid, IMG.eco1]),
    coaCertificateNumber: "GZ-COA-2026-0011",
    coaIssueDate: daysAgo(41),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-college-street/",
      },
    ]),
    statusHistory: history(
      ["draft", 50],
      ["pending_approval", 45],
      ["marketplace", 38],
      ["reserved", 24],
    ),
  },

  // --- Ananya Deshmukh (zero tiers, textile art) ------------------------
  {
    id: "field-of-kusum-dye",
    title: "Field of Kusum Dye",
    artistId: "ananya-deshmukh",
    ...artistMeta("ananya-deshmukh"),
    category: "textile art",
    medium: "Hand Embroidery on Cotton, Natural Dye",
    customerPrice: 10400,
    thumbnailUrl: IMG.drape,
    insured: false,
    status: "marketplace",
    listingType: "marketplace_only",
    description:
      "A wall-hung textile piece hand-embroidered on handwoven cotton, dyed using kusum flower and iron-mordant baths mixed in small batches. Ananya draws the design directly onto the cloth freehand before stitching, so no two pieces in this series share an identical layout. Comes with a fabric-care card and a wooden hanging dowel.",
    dimensions: "22x30 in",
    yearCreated: 2026,
    images: images("Field of Kusum Dye", [IMG.drape, IMG.eco2, IMG.journey]),
    coaCertificateNumber: "GZ-COA-2026-0012",
    coaIssueDate: daysAgo(13),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-kusum-dye/",
      },
    ]),
    statusHistory: history(
      ["draft", 20],
      ["pending_approval", 16],
      ["marketplace", 10],
    ),
  },
  {
    id: "grandmothers-stitch-revisited",
    title: "Grandmother's Stitch, Revisited",
    artistId: "ananya-deshmukh",
    ...artistMeta("ananya-deshmukh"),
    category: "textile art",
    medium: "Hand Embroidery on Cotton, Natural Dye",
    customerPrice: 13900,
    thumbnailUrl: IMG.drape,
    insured: false,
    status: "marketplace",
    listingType: "marketplace_only",
    description:
      "Ananya's largest piece to date, reworking a border-stitch pattern her grandmother taught her as a continuous field across the full canvas rather than a framing edge. Every dye bath in this piece was mixed from marigold and pomegranate rind sourced from her family's own kitchen garden. Her first major listing on GalleryZone.",
    dimensions: "24x36 in",
    yearCreated: 2026,
    images: images("Grandmother's Stitch, Revisited", [
      IMG.drape,
      IMG.journey,
      IMG.eco3,
      IMG.idPaint,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0013",
    coaIssueDate: daysAgo(9),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-grandmothers-stitch",
      },
    ]),
    statusHistory: history(
      ["draft", 15],
      ["pending_approval", 12],
      ["marketplace", 6],
    ),
  },

  // --- Ishaan Kapoor (tier1+tier3, painting) ----------------------------
  {
    id: "concrete-bloom",
    title: "Concrete Bloom",
    artistId: "ishaan-kapoor",
    ...artistMeta("ishaan-kapoor"),
    category: "painting",
    medium: "Acrylic on Canvas",
    customerPrice: 21600,
    thumbnailUrl: IMG.framed,
    insured: true,
    status: "marketplace",
    listingType: "marketplace_only",
    description:
      "Built up in thin acrylic layers over several weeks, this canvas fractures a stairwell in Ishaan's own apartment block into overlapping planes of colour until the architecture starts to read as botanical. He works without preparatory sketches, building the composition directly on the canvas and painting out sections that don't hold. Full studio session filmed start to finish.",
    dimensions: "30x30 in",
    yearCreated: 2026,
    images: images("Concrete Bloom", [
      IMG.framed,
      IMG.landscape,
      IMG.eco1,
      IMG.journey,
      IMG.bird,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0014",
    coaIssueDate: daysAgo(69),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-concrete-bloom",
      },
    ]),
    statusHistory: history(
      ["draft", 80],
      ["pending_approval", 74],
      ["marketplace", 66],
    ),
  },
  {
    id: "fractured-skyline",
    title: "Fractured Skyline",
    artistId: "ishaan-kapoor",
    ...artistMeta("ishaan-kapoor"),
    category: "painting",
    medium: "Acrylic on Canvas",
    customerPrice: 34500,
    thumbnailUrl: IMG.landscape,
    insured: true,
    status: "marketplace",
    listingType: "marketplace_only",
    description:
      "Ishaan's largest canvas to date, breaking the Delhi skyline seen from his studio window into a grid of overlapping vantage points painted in separate sessions and reassembled as one composition. The underlying pencil grid is still faintly visible beneath the paint in several passages, left intentionally. Ships stretched and ready to hang.",
    dimensions: "36x48 in",
    yearCreated: 2025,
    images: images("Fractured Skyline", [
      IMG.landscape,
      IMG.framed,
      IMG.eco2,
      IMG.journey,
      IMG.idPaint,
      IMG.bird,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0015",
    coaIssueDate: daysAgo(109),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-fractured-skyline",
      },
      {
        platform: "tiktok",
        url: "https://www.tiktok.com/@ishaankapoorstudio/video/7345678901234567890",
      },
    ]),
    statusHistory: history(
      ["draft", 120],
      ["pending_approval", 114],
      ["marketplace", 105],
    ),
  },
  {
    id: "density-study-karol-bagh",
    title: "Density Study, Karol Bagh",
    artistId: "ishaan-kapoor",
    ...artistMeta("ishaan-kapoor"),
    category: "painting",
    medium: "Acrylic on Canvas",
    customerPrice: 26200,
    thumbnailUrl: IMG.framed,
    insured: true,
    status: "reserved",
    listingType: "marketplace_and_aggregator",
    description:
      "A study of the wholesale market lanes in Karol Bagh at closing time, built from overlapping fractured planes in a tighter, more restrained palette than Ishaan's larger canvases. Painted directly from memory the same evening rather than from photographs. Currently on reserve for gallery display.",
    dimensions: "24x30 in",
    yearCreated: 2026,
    images: images("Density Study, Karol Bagh", [
      IMG.framed,
      IMG.eco3,
      IMG.landscape,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0016",
    coaIssueDate: daysAgo(41),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-density-study/",
      },
    ]),
    statusHistory: history(
      ["draft", 52],
      ["pending_approval", 46],
      ["marketplace", 38],
      ["reserved", 28],
    ),
  },

  // --- Priya Subramaniam (tier2+tier3, mixed media) ---------------------
  {
    id: "rust-and-ochre-wall-piece",
    title: "Rust and Ochre Wall Piece",
    artistId: "priya-subramaniam",
    ...artistMeta("priya-subramaniam"),
    category: "mixed media",
    medium: "Repurposed Metal and Pigment on Panel",
    customerPrice: 58000,
    thumbnailUrl: IMG.busts,
    insured: true,
    status: "reserved",
    listingType: "marketplace_and_aggregator",
    description:
      "Built from sheet-metal offcuts sourced from a scrapyard near her studio collective, welded to a plywood panel and finished with layered pigment and controlled oxidation. Priya lets the metal rust naturally over several weeks under wet cloths before sealing the surface, so the final colour is never fully predictable. Currently on reserve for gallery display.",
    dimensions: "30 in H x 40 in W x 4 in D",
    yearCreated: 2025,
    images: images("Rust and Ochre Wall Piece", [
      IMG.busts,
      IMG.pyramid,
      IMG.eco1,
      IMG.drape,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0017",
    coaIssueDate: daysAgo(35),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-rust-ochre",
      },
    ]),
    statusHistory: history(
      ["draft", 45],
      ["pending_approval", 40],
      ["marketplace", 32],
      ["reserved", 12],
    ),
  },
  {
    id: "salvaged-frequencies",
    title: "Salvaged Frequencies",
    artistId: "priya-subramaniam",
    ...artistMeta("priya-subramaniam"),
    category: "mixed media",
    medium: "Repurposed Metal and Pigment on Panel",
    customerPrice: 44500,
    thumbnailUrl: IMG.busts,
    insured: true,
    status: "sold",
    listingType: "marketplace_and_aggregator",
    description:
      "An earlier, smaller panel in Priya's welded-metal series, built around a cut radio dial salvaged from a decommissioned workshop. The pigment layer was applied in three separate sessions to let each coat oxidize the metal differently before the next. Sold through a partner aggregator; settlement in progress.",
    dimensions: "24 in H x 32 in W x 3 in D",
    yearCreated: 2024,
    images: images("Salvaged Frequencies", [
      IMG.busts,
      IMG.pyramid,
      IMG.drape,
      IMG.eco2,
      IMG.eco3,
      IMG.journey,
      IMG.bird,
      IMG.portrait,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0018",
    coaIssueDate: daysAgo(150),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-salvaged-frequencies/",
      },
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-salvaged-frequencies",
      },
    ]),
    statusHistory: history(
      ["draft", 160],
      ["pending_approval", 154],
      ["marketplace", 146],
      ["reserved", 37],
      ["sold", 10],
    ),
  },

  // --- Reservable aggregator stock -------------------------------------
  // Eight pieces that exist purely so the Aggregator Portal's Inventory page
  // has something left to reserve. Everything above is either claimed by a
  // holding in aggregator-holdings.ts or marketplace-only, which left the
  // grid with exactly two cards and an empty state one click later.
  //
  // All eight are aggregator-eligible, "marketplace" status and referenced by
  // no holding, so listReservableInventory() picks them up. They carry a real
  // `physical` block because MOU §12 governs anything sent for aggregator
  // display — framed or stretched, hangers included, packed to standard.
  {
    id: "terrace-garden-after-rain",
    title: "Terrace Garden, After Rain",
    artistId: "meera-nair",
    ...artistMeta("meera-nair"),
    category: "painting",
    medium: "Oil on Canvas",
    customerPrice: 26600,
    thumbnailUrl: IMG.landscape,
    insured: true,
    status: "marketplace",
    listingType: "marketplace_and_aggregator",
    description:
      "A rooftop in Fort Kochi an hour after the rain stops, when the water still standing in the planters throws the sky back up at the wall. Built in thin oil glazes so the white of the ground keeps coming through the greens, with the puddles scraped back rather than painted in.",
    dimensions: "30x40 in",
    yearCreated: 2026,
    images: images("Terrace Garden, After Rain", [
      IMG.landscape,
      IMG.framed,
      IMG.journey,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0019",
    coaIssueDate: daysAgo(41),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-terrace-garden/",
      },
    ]),
    statusHistory: history(
      ["draft", 52],
      ["pending_approval", 47],
      ["marketplace", 41],
    ),
    physical: {
      weightKg: 4.2,
      framing: "framed",
      format: "Canvas on stretcher, teak frame",
      hangingHardwareIncluded: true,
      packagingConfirmed: true,
    },
  },
  {
    id: "weight-of-a-quiet-room",
    title: "Weight of a Quiet Room",
    artistId: "arjun-mehta",
    ...artistMeta("arjun-mehta"),
    category: "sculpture",
    medium: "Cast Bronze",
    customerPrice: 84500,
    thumbnailUrl: IMG.busts,
    insured: true,
    status: "marketplace",
    listingType: "marketplace_and_aggregator",
    description:
      "A seated figure reduced to the three planes that still read as a person from across a room. Sand-cast in a single pour, then worked back by hand at the shoulders so the tool marks stay visible under the patina. Supplied on a machined steel base.",
    dimensions: "18x11x14 in",
    yearCreated: 2025,
    images: images("Weight of a Quiet Room", [
      IMG.busts,
      IMG.drape,
      IMG.eco1,
      IMG.portrait,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0020",
    coaIssueDate: daysAgo(63),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-quiet-room/",
      },
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-quiet-room-pour",
      },
    ]),
    statusHistory: history(
      ["draft", 78],
      ["pending_approval", 71],
      ["marketplace", 63],
    ),
    physical: {
      weightKg: 16.5,
      framing: "freestanding",
      format: "Bronze on steel base",
      hangingHardwareIncluded: false,
      packagingConfirmed: true,
    },
  },
  {
    id: "platform-nine-first-light",
    title: "Platform Nine, First Light",
    artistId: "kavya-iyer",
    ...artistMeta("kavya-iyer"),
    category: "photography",
    medium: "Archival Pigment Print",
    customerPrice: 18200,
    thumbnailUrl: IMG.framed,
    insured: false,
    status: "marketplace",
    listingType: "marketplace_and_aggregator",
    description:
      "Shot at 5.40am from the far end of Platform Nine, waiting for the one minute when the station lights and the daylight are the same temperature and the whole shed goes flat. Printed on cotton rag in an edition of twelve, each one numbered on the reverse.",
    dimensions: "16x24 in",
    yearCreated: 2026,
    images: images("Platform Nine, First Light", [
      IMG.framed,
      IMG.eco2,
      IMG.landscape,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0021",
    coaIssueDate: daysAgo(29),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-platform-nine/",
      },
    ]),
    statusHistory: history(
      ["draft", 38],
      ["pending_approval", 34],
      ["marketplace", 29],
    ),
    physical: {
      weightKg: 2.1,
      framing: "framed",
      format: "Cotton rag print, museum glass",
      hangingHardwareIncluded: true,
      packagingConfirmed: true,
    },
  },
  {
    id: "letterpress-for-a-lost-street",
    title: "Letterpress for a Lost Street",
    artistId: "rohan-bhattacharya",
    ...artistMeta("rohan-bhattacharya"),
    category: "printmaking",
    medium: "Linocut on Paper",
    customerPrice: 15600,
    thumbnailUrl: IMG.pyramid,
    insured: false,
    status: "marketplace",
    listingType: "marketplace_and_aggregator",
    description:
      "Cut from a single block after the shopfronts on the artist's own street were painted over in one weekend. The signage lettering is set from wood type salvaged from the press that used to print those shutters, so the piece is partly made of the thing it records.",
    dimensions: "14x20 in",
    yearCreated: 2025,
    images: images("Letterpress for a Lost Street", [
      IMG.pyramid,
      IMG.eco3,
      IMG.framed,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0022",
    coaIssueDate: daysAgo(55),
    socialProofLinks: social([]),
    statusHistory: history(
      ["draft", 66],
      ["pending_approval", 61],
      ["marketplace", 55],
    ),
    physical: {
      weightKg: 1.6,
      framing: "framed",
      format: "Handmade paper, ash frame",
      hangingHardwareIncluded: true,
      packagingConfirmed: true,
    },
  },
  {
    id: "kantha-in-three-registers",
    title: "Kantha in Three Registers",
    artistId: "ananya-deshmukh",
    ...artistMeta("ananya-deshmukh"),
    category: "textile art",
    medium: "Hand Embroidery on Cotton, Natural Dye",
    customerPrice: 32400,
    thumbnailUrl: IMG.drape,
    insured: true,
    status: "marketplace",
    // Aggregator-only: this one is meant to be seen and handled in person,
    // so it never appears in the online marketplace grid.
    listingType: "aggregator_only",
    description:
      "Three bands of running stitch worked at three different densities across a single dyed field, so the cloth reads as one surface from a distance and as three separate weathers up close. Roughly four months of stitching, in madder, indigo and pomegranate rind.",
    dimensions: "36x48 in",
    yearCreated: 2025,
    images: images("Kantha in Three Registers", [
      IMG.drape,
      IMG.eco1,
      IMG.portrait,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0023",
    coaIssueDate: daysAgo(35),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-kantha-registers/",
      },
    ]),
    statusHistory: history(
      ["draft", 45],
      ["pending_approval", 40],
      ["marketplace", 35],
    ),
    physical: {
      weightKg: 3.4,
      framing: "stretched_canvas",
      format: "Cotton stretched on a hardwood frame",
      hangingHardwareIncluded: true,
      packagingConfirmed: true,
    },
  },
  {
    id: "signal-loss-diptych",
    title: "Signal Loss (Diptych)",
    artistId: "priya-subramaniam",
    ...artistMeta("priya-subramaniam"),
    category: "mixed media",
    medium: "Repurposed Metal and Pigment on Panel",
    customerPrice: 47800,
    thumbnailUrl: IMG.eco2,
    insured: true,
    status: "marketplace",
    listingType: "marketplace_and_aggregator",
    description:
      "Two panels built from the housings of dead television sets, flattened, primed and worked over in dry pigment until the seams of the original casing come back through. Hung as a pair with a fixed four-inch gap, which is part of the work rather than a display note.",
    dimensions: "24x36 in (each panel)",
    yearCreated: 2026,
    images: images("Signal Loss (Diptych)", [
      IMG.eco2,
      IMG.eco3,
      IMG.pyramid,
      IMG.busts,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0024",
    coaIssueDate: daysAgo(22),
    socialProofLinks: social([
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-signal-loss-build",
      },
    ]),
    statusHistory: history(
      ["draft", 31],
      ["pending_approval", 27],
      ["marketplace", 22],
    ),
    physical: {
      weightKg: 11.8,
      framing: "mounted_board",
      format: "Metal and pigment on birch panel",
      hangingHardwareIncluded: true,
      packagingConfirmed: true,
    },
  },
  {
    id: "noon-heat-chettinad",
    title: "Noon Heat, Chettinad",
    artistId: "ishaan-kapoor",
    ...artistMeta("ishaan-kapoor"),
    category: "painting",
    medium: "Acrylic on Canvas",
    customerPrice: 96200,
    thumbnailUrl: IMG.idPaint,
    insured: true,
    status: "marketplace",
    listingType: "marketplace_and_aggregator",
    description:
      "The largest canvas in this series, and the one that gave up its horizon: a courtyard at the hour when the light is so flat that the walls, the floor and the sky all resolve to the same value. Painted in acrylic for the speed, then knocked back with a dry brush over four weeks.",
    dimensions: "48x60 in",
    yearCreated: 2026,
    images: images("Noon Heat, Chettinad", [
      IMG.idPaint,
      IMG.landscape,
      IMG.framed,
      IMG.journey,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0025",
    coaIssueDate: daysAgo(17),
    socialProofLinks: social([
      {
        platform: "instagram",
        url: "https://www.instagram.com/reel/gz-noon-heat-chettinad/",
      },
      {
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=gz-noon-heat-process",
      },
    ]),
    statusHistory: history(
      ["draft", 27],
      ["pending_approval", 22],
      ["marketplace", 17],
    ),
    physical: {
      weightKg: 7.9,
      framing: "stretched_canvas",
      format: "Canvas on deep stretcher, unframed edges",
      hangingHardwareIncluded: true,
      packagingConfirmed: true,
    },
  },
  {
    id: "verdigris-study-no-4",
    title: "Verdigris Study No. 4",
    artistId: "arjun-mehta",
    ...artistMeta("arjun-mehta"),
    category: "sculpture",
    medium: "Cast Bronze",
    customerPrice: 21900,
    thumbnailUrl: IMG.eco3,
    insured: false,
    status: "marketplace",
    // Aggregator-only: a small wall piece the artist wants placed in person.
    listingType: "aggregator_only",
    description:
      "A wall-mounted bronze the size of an open hand, patinated in stages over six weeks and stopped at the point where the green had taken but the metal underneath still showed at the edges. Fourth in a run of nine, each one halted at a different week.",
    dimensions: "9x7x2 in",
    yearCreated: 2025,
    images: images("Verdigris Study No. 4", [
      IMG.eco3,
      IMG.busts,
      IMG.eco1,
    ]),
    coaCertificateNumber: "GZ-COA-2026-0026",
    coaIssueDate: daysAgo(48),
    socialProofLinks: social([]),
    statusHistory: history(
      ["draft", 58],
      ["pending_approval", 54],
      ["marketplace", 48],
    ),
    physical: {
      weightKg: 2.8,
      framing: "framed",
      format: "Bronze on a mounted backing plate",
      hangingHardwareIncluded: true,
      packagingConfirmed: true,
    },
  },
];
