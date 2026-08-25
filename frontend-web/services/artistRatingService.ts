import { artistReviewsCol } from "@/lib/mock-collections";
import { mockDelay } from "@/lib/mock-utils";
import {
  artistIdFromUserId,
  summarizeRating,
  type ArtistRating,
  type ArtistReview,
} from "@/types/artist-rating";

// What collectors think of an artist. Same shape as every other service here:
// fixture data behind mockDelay, persisted through lib/mock-collections.ts.
//
// This was `artistNetworkService` and also carried artist-to-artist
// connections and collaborations. That feature is gone; a review is earned on
// a sale, so what is left is buyer feedback and the name says so.

export const artistRatingService = {
  // --- Ratings -------------------------------------------------------------

  getRating: (artistId: string): Promise<ArtistRating> =>
    mockDelay(summarizeRating(artistId, artistReviewsCol.get())),

  listReviews: (artistId: string): Promise<ArtistReview[]> =>
    mockDelay(
      artistReviewsCol
        .get()
        .filter((r) => r.artistId === artistId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),

  // Admin's view: one summary per artist, keyed by the AdminUser id it will
  // be joined against, so the table does not have to know how ids map.
  listRatingsByUserId: (
    userIds: string[],
  ): Promise<Record<string, ArtistRating>> => {
    const reviews = artistReviewsCol.get();
    return mockDelay(
      Object.fromEntries(
        userIds.map((userId) => [
          userId,
          summarizeRating(artistIdFromUserId(userId), reviews),
        ]),
      ),
    );
  }
};
