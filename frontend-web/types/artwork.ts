export type ArtworkStatus =
  | "draft"
  | "pending_approval"
  | "marketplace"
  | "reserved"
  | "preparing_dispatch"
  | "in_transit"
  | "with_aggregator"
  | "sold"
  | "settlement_complete"
  | "delivered"
  | "completed"
  | "returned"
  // Artist sold the piece somewhere else and marked it here — it leaves every
  // GalleryZone sales channel immediately (see markSoldElsewhere in
  // services/artistDashboardService.ts).
  | "sold_externally";

// The artist picks the sales channel(s) a piece is listed through. Marketplace
// (GalleryZone's own online store) and Aggregator (partner premises that hold
// and display the physical work) are independent channels; "both" is the
// union of the two, not a third channel.
export type ListingType =
  | "marketplace_only"
  | "aggregator_only"
  | "marketplace_and_aggregator";

export const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  marketplace_only: "Marketplace only",
  aggregator_only: "Aggregator only",
  marketplace_and_aggregator: "Marketplace + Aggregator",
};

// Always ask these two rather than comparing against a literal: adding a
// channel later shouldn't mean hunting down every `=== "marketplace_and_
// aggregator"` in the codebase again.
export function isMarketplaceListed(listingType: ListingType): boolean {
  return listingType !== "aggregator_only";
}

export function isAggregatorListed(listingType: ListingType): boolean {
  return listingType !== "marketplace_only";
}

export interface ArtworkImage {
  url: string;
  thumbnailUrl: string;
  sortOrder: number;
  altText: string;
}

export interface SocialProofLink {
  platform: "instagram" | "youtube" | "x" | "tiktok";
  url: string;
}

export interface ArtworkStatusEvent {
  status: ArtworkStatus;
  changedAt: string; // ISO date
}

// Matches the GET /marketplace list-item shape documented in the SAD (§3.4)
export interface ArtworkSummary {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  verifiedArtist: boolean;
  category: string;
  medium: string;
  customerPrice: number;
  thumbnailUrl: string;
  insured: boolean;
  status: ArtworkStatus;
  listingType: ListingType;
}

export interface Artwork extends ArtworkSummary {
  description: string;
  dimensions: string | null;
  yearCreated: number | null;
  images: ArtworkImage[]; // up to 8, sortOrder 0 = cover
  coaCertificateNumber: string;
  coaIssueDate: string;
  socialProofLinks: SocialProofLink[];
  statusHistory: ArtworkStatusEvent[];
  // Physical NFC/QR tag linked to this artwork's digital passport (Onboarding
  // Guide Stage 5). Optional so the 30+ existing fixture records don't need
  // a value; undefined/null both mean "not yet tagged".
  nfcTagId?: string | null;
  // Ownership, physical custody and location are three independent states,
  // never one "owner" field — a piece can be legally owned by GalleryZone,
  // physically held by an aggregator, and located in a third city all at
  // once. Optional so existing fixture records don't need a value:
  // resolveCustody() derives one from `status` when it's absent.
  custody?: ArtworkCustody | null;
}

// --- Ownership / custody / location -----------------------------------------

export type CustodyParty = "artist" | "galleryzone" | "aggregator" | "customer";

export const CUSTODY_PARTY_LABEL: Record<CustodyParty, string> = {
  artist: "Artist",
  galleryzone: "GalleryZone",
  aggregator: "Aggregator",
  customer: "Collector",
};

export interface ArtworkCustody {
  legalOwner: CustodyParty;
  custodian: CustodyParty;
  locationLabel: string;
}

// Fallback custody for a record that doesn't carry an explicit one yet.
// Deriving from status is a stopgap for the mock phase only — once transfers
// are recorded as real events, `custody` is written on every transition and
// this map stops being consulted.
const DERIVED_CUSTODY: Record<ArtworkStatus, ArtworkCustody> = {
  draft: { legalOwner: "artist", custodian: "artist", locationLabel: "Artist studio" },
  pending_approval: { legalOwner: "artist", custodian: "artist", locationLabel: "Artist studio" },
  marketplace: { legalOwner: "artist", custodian: "artist", locationLabel: "Artist studio" },
  reserved: { legalOwner: "artist", custodian: "artist", locationLabel: "Artist studio" },
  preparing_dispatch: { legalOwner: "artist", custodian: "artist", locationLabel: "Awaiting pickup" },
  in_transit: { legalOwner: "artist", custodian: "galleryzone", locationLabel: "In transit" },
  with_aggregator: { legalOwner: "artist", custodian: "aggregator", locationLabel: "Aggregator premises" },
  sold: { legalOwner: "customer", custodian: "galleryzone", locationLabel: "Awaiting delivery" },
  settlement_complete: { legalOwner: "customer", custodian: "galleryzone", locationLabel: "Awaiting delivery" },
  delivered: { legalOwner: "customer", custodian: "customer", locationLabel: "With the collector" },
  completed: { legalOwner: "customer", custodian: "customer", locationLabel: "With the collector" },
  returned: { legalOwner: "artist", custodian: "artist", locationLabel: "Returned to artist" },
  sold_externally: { legalOwner: "customer", custodian: "customer", locationLabel: "Sold outside GalleryZone" },
};

export function resolveCustody(artwork: Artwork): ArtworkCustody {
  return artwork.custody ?? DERIVED_CUSTODY[artwork.status];
}

// --- Edit window -------------------------------------------------------------

export const ARTWORK_EDIT_WINDOW_DAYS = 7;

// A purchase or claim ends the edit window immediately, however many of the
// 7 days are left.
const PURCHASE_LOCKED_STATUSES = new Set<ArtworkStatus>([
  "reserved",
  "preparing_dispatch",
  "in_transit",
  "sold",
  "settlement_complete",
  "delivered",
  "completed",
  "sold_externally",
]);

export type ArtworkEditState =
  | { editable: true; reason: "draft" | "within_window"; daysLeft: number }
  | { editable: false; reason: "purchased" | "window_closed"; daysLeft: 0 };

const DAY_MS = 24 * 60 * 60 * 1000;

// 7 days from first listing OR until the piece is bought/claimed — whichever
// comes first. Drafts aren't listed yet, so they stay editable indefinitely.
export function artworkEditState(
  artwork: Pick<Artwork, "status" | "statusHistory">,
  now: number = Date.now(),
): ArtworkEditState {
  if (artwork.status === "draft") {
    return { editable: true, reason: "draft", daysLeft: ARTWORK_EDIT_WINDOW_DAYS };
  }
  if (PURCHASE_LOCKED_STATUSES.has(artwork.status)) {
    return { editable: false, reason: "purchased", daysLeft: 0 };
  }

  const listedAt = artwork.statusHistory[0]?.changedAt;
  if (!listedAt) {
    return { editable: true, reason: "within_window", daysLeft: ARTWORK_EDIT_WINDOW_DAYS };
  }

  const elapsedDays = (now - new Date(listedAt).getTime()) / DAY_MS;
  const daysLeft = Math.ceil(ARTWORK_EDIT_WINDOW_DAYS - elapsedDays);
  return daysLeft > 0
    ? { editable: true, reason: "within_window", daysLeft }
    : { editable: false, reason: "window_closed", daysLeft: 0 };
}

// --- Selling outside GalleryZone ---------------------------------------------

// Charged on the artist's NEXT listing when they mark a piece sold elsewhere,
// as a percentage of that piece's listed price.
export const EXTERNAL_SALE_PENALTY_RATE = 0.01;

// An artist can withdraw a piece as "sold elsewhere" only while GalleryZone
// has no claim on it. One set, read by both the dashboard UI and the service
// guard, so the button and the rule can never disagree.
export const WITHDRAWABLE_STATUSES = new Set<ArtworkStatus>([
  "draft",
  "pending_approval",
  "marketplace",
]);

export interface ExternalSalePenalty {
  id: string;
  artworkId: string;
  artworkTitle: string;
  amount: number;
  createdAt: string;
  settledAt: string | null;
}

export interface ArtworkFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  medium?: string;
  query?: string;
  sortBy?: "newest" | "price_asc" | "price_desc";
}
