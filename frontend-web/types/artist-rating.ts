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
  const breakdown: Record<StarRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
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
