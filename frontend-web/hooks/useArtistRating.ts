import { useQuery } from "@tanstack/react-query";
import { artistRatingService } from "@/services/artistRatingService";

// Collector ratings and reviews. Page → Hook → Service, like every
// other data path here; components never call the service directly.

export function useArtistRating(artistId: string) {
  return useQuery({
    queryKey: ["artist-rating", artistId],
    queryFn: () => artistRatingService.getRating(artistId),
  });
}

export function useArtistReviews(artistId: string) {
  return useQuery({
    queryKey: ["artist-reviews", artistId],
    queryFn: () => artistRatingService.listReviews(artistId),
  });
}

/** Admin's whole-platform view, keyed by AdminUser id. */
export function useArtistRatingsByUserId(userIds: string[]) {
  const key = [...userIds].sort().join(",");
  return useQuery({
    queryKey: ["artist-ratings-by-user", key],
    queryFn: () => artistRatingService.listRatingsByUserId(userIds),
    enabled: userIds.length > 0,
  });
}
