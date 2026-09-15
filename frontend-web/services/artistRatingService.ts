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

  // Reviews aren't collected on the API yet, so every artist has an honest
  // zero — never a fixture score.
  getRating: async (artistId: string): Promise<ArtistRating> => summarizeRating(artistId, []),

  listReviews: async (_artistId: string): Promise<ArtistReview[]> => [],

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
