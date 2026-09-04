// What collectors think of an artist. A review is always earned on a sale, so
// this is buyer feedback — it is not, and never was, the artist-to-artist
// community feature that used to live alongside it.

export type StarRating = 1 | 2 | 3 | 4 | 5;

export interface ArtistReview {
  id: string;
  artistId: string;
  reviewerName: string;
  rating: StarRating;
  comment: string;
  /** The piece the review is about — a rating is always earned on a sale. */
  artworkTitle: string;
  createdAt: string; // ISO
}

export interface ArtistRating {
  artistId: string;
  /** Mean of every review, to one decimal. 0 when there are none. */
  average: number;
  count: number;
  /** How many reviews sat at each star, 5 → 1. Drives the breakdown bars. */
  breakdown: Record<StarRating, number>;
}

export const STAR_VALUES: StarRating[] = [5, 4, 3, 2, 1];

// The one place that turns reviews into a score. The dashboard card, the admin
// table and any future public badge all call this, so they cannot disagree
// about what "4.6" means.
export function summarizeRating(
  artistId: string,
  reviews: ArtistReview[],
): ArtistRating {
  const mine = reviews.filter((r) => r.artistId === artistId);
  const breakdown: Record<StarRating, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  for (const review of mine) breakdown[review.rating] += 1;

  if (mine.length === 0) {
    return { artistId, average: 0, count: 0, breakdown };
  }

  const total = mine.reduce((sum, r) => sum + r.rating, 0);
  return {
    artistId,
    average: Math.round((total / mine.length) * 10) / 10,
    count: mine.length,
    breakdown,
  };
}

// Admin lists artists by their AdminUser record, whose id is the artist id
// with a "user-" prefix — except the demo artist, seeded as
// "user-artist-devika-rao" against an artist id of "devika-rao". Both shapes
// resolve here rather than at each call site.
export function artistIdFromUserId(userId: string): string {
  return userId.replace(/^user-/, "").replace(/^artist-/, "");
}

// --- Composite 0-10 score ---------------------------------------------------
//
// PLACEHOLDER pending client sign-off — see the "Ten-Point Score" note
// (handwritten, "in Ratings", client meeting Aug 2026). The note settles that
// the card moves to a 0-10 composite (customer ratings + profile completion +
// artwork count, "like that way") and that Latest Reviews comes off the card,
// but leaves five things open: a possible on-time-delivery factor, the exact
// weight split, the artwork-count curve, a possible fourth factor, and where
// the review text goes once it's off this card. Until the client answers,
// this implements the doc's own *recommended* option on each fork:
//   - On-time delivery: dropped (no ground-truth delivery dates stored yet).
//   - Weight split: customer-dominant, re-weighted to 100% across the three
//     factors that remain without delivery.
//   - Artwork-count curve: linear to 10 (0 pieces = 0, 10+ = full marks).
// Once the client answers, this is the one place that changes — the card,
// the admin table and any future public badge all call scoreArtist(), the
// same way summarizeRating() above is the one place star averages are
// computed. Port to lib/core/ in the Flutter app the same way pricing is
// ported, rather than duplicating the formula there.

export interface RatingScoreFactors {
  /** 0-10. From ArtistRating.average (out of 5), doubled. */
  customerRating: number;
  /** 0-10. Share of profile fields filled in — see profileCompletionScore(). */
  profileCompletion: number;
  /** 0-10. Linear to 10 listed artworks — see artworkCountScore(). */
  artworkCount: number;
}

export const RATING_SCORE_WEIGHTS: Record<keyof RatingScoreFactors, number> = {
  customerRating: 0.65,
  profileCompletion: 0.25,
  artworkCount: 0.1,
};

/** Linear to 10 — 0 artworks = 0, 10+ artworks = full marks. */
export function artworkCountScore(artworkCount: number): number {
  return Math.min(10, Math.max(0, artworkCount)) * 1;
}

/**
 * Fraction of a fixed set of profile fields the artist has filled in,
 * scaled to 0-10. Kept intentionally simple (equal weight per field) since
 * the client hasn't specified which fields should count more.
 */
export function profileCompletionScore(fields: {
  bio: string;
  instagram: string;
  website: string;
  bankAccountMasked: string;
  ifsc: string;
  pan: string | null;
  gstin: string;
  aadhaarStatus: string;
  pickupLine1: string;
  pickupPincode: string;
}): number {
  const checks = [
    fields.bio.trim().length > 0,
    fields.instagram.trim().length > 0,
    fields.website.trim().length > 0,
    fields.bankAccountMasked.trim().length > 0,
    fields.ifsc.trim().length > 0,
    Boolean(fields.pan?.trim()),
    fields.gstin.trim().length > 0,
    fields.aadhaarStatus === "verified",
    fields.pickupLine1.trim().length > 0,
    fields.pickupPincode.trim().length > 0,
  ];
  const filled = checks.filter(Boolean).length;
  return (filled / checks.length) * 10;
}

/** The one place that turns the composite factors into the card's single number. */
export function scoreArtist(factors: RatingScoreFactors): number {
  const raw =
    factors.customerRating * RATING_SCORE_WEIGHTS.customerRating +
    factors.profileCompletion * RATING_SCORE_WEIGHTS.profileCompletion +
    factors.artworkCount * RATING_SCORE_WEIGHTS.artworkCount;
  return Math.round(raw * 10) / 10;
}
