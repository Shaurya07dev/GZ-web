// What each of the three actors looks like at a glance, derived — never
// stored. Every figure here is computed from the collections that already hold
// the truth (artworks, orders, holdings, reviews), so a stat can never drift
// from the thing it counts.
//
// The privacy line runs through this file. An ARTIST's stats split in two:
// what a visiting collector may see, and what only the artist sees on their
// own dashboard. Counts, dates and the publicly-listed price range are public;
// what the artist is actually PAID never is (SAD §8.7 — the artist price is
// confidential, and every markup, settlement and payout figure is derived from
// it). Putting the split in the type is what stops a component leaking one
// into the other by accident.

import type { ArtistRating } from "./artist-rating";

/** Inclusive low/high of what a set of pieces is listed at. */
export interface PriceRange {
  low: number;
  high: number;
}

// --- Artist -----------------------------------------------------------------

export interface ArtistPublicStats {
  /** Live on the open marketplace right now. */
  artworksListed: number;
  /** Sold through any channel, ever. */
  worksSold: number;
  /** Currently placed with a partner gallery. */
  onDisplay: number;
  /** Distinct mediums they actually work in, most-used first. */
  mediums: string[];
  categories: string[];
  /**
   * What their listed work costs a buyer. Public because it is on every
   * artwork card already — this is the customer-facing price, not the
   * artist's.
   */
  listedPriceRange: PriceRange | null;
  rating: ArtistRating;
  /** Accepted artist-to-artist connections. */
  connections: number;
  joinedAt: string;
  verifiedTiers: 0 | 1 | 2 | 3;
}

/**
 * Only ever rendered on the artist's own dashboard. Every field here is a
 * figure the artist's own price can be worked backwards from, which is exactly
 * why it is a separate type from [ArtistPublicStats].
 */
export interface ArtistPrivateStats {
  /** Paid out and in the bank. */
  lifetimeEarnings: number;
  /** Sold, but not yet released — see artistPayoutService. */
  pendingEarnings: number;
  /** Mean of what they have actually been paid per sold piece. */
  averageSalePrice: number;
  /** Submitted and waiting on review. */
  awaitingReview: number;
  drafts: number;
}

// --- Aggregator -------------------------------------------------------------

export interface AggregatorStats {
  /** Pieces held right now, across every gallery space. */
  onDisplay: number;
  /** Sold through this aggregator, ever. */
  piecesSold: number;
  /** Pieces returned to GalleryZone unsold. */
  returned: number;
  /** Commission earned, settled and unsettled. */
  commissionEarned: number;
  /** Advance + delivery currently held against live reservations. */
  heldAgainstReservations: number;
  /** Cash collected at the counter and not yet transferred. */
  owedToGalleryZone: number;
  gallerySpaces: number;
  /** Total pieces every space could display at once. */
  displayCapacity: number;
  cities: string[];
  distinctBuyers: number;
  /** Null until they sign the partner agreement. */
  mouSignedAt: string | null;
}

// --- Collector --------------------------------------------------------------

export interface CollectorStats {
  /** Pieces delivered and owned. */
  worksOwned: number;
  ordersPlaced: number;
  /** In transit, packed, or otherwise not yet delivered. */
  inProgress: number;
  /** What they have actually paid, across every completed order. */
  totalSpent: number;
  wishlisted: number;
  /** Their own pieces currently listed for resale. */
  listedForResale: number;
  /** Artists they collect more than one piece from, most-collected first. */
  artistsCollected: string[];
  walletBalance: number;
  joinedAt: string;
}
