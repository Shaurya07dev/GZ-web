import { useQuery } from "@tanstack/react-query";
import { profileStatsService } from "@/services/profileStatsService";

// Page → Hook → Service, like every other data path here.
//
// Each key is scoped to the actor it describes, so invalidating one profile's
// figures never refetches another's. Nothing here is stored — the service
// derives every number on read — so these queries are cheap to invalidate
// whenever the underlying thing moves.

export function useArtistPublicStats(artistId: string) {
  return useQuery({
    queryKey: ["profile-stats", "artist", artistId],
    queryFn: () => profileStatsService.artistPublic(artistId),
  });
}

/** The artist's own figures. Never rendered on a public page. */
export function useArtistPrivateStats(artistId: string) {
  return useQuery({
    queryKey: ["profile-stats", "artist-private", artistId],
    queryFn: () => profileStatsService.artistPrivate(artistId),
  });
}

export function useAggregatorStats() {
  return useQuery({
    queryKey: ["profile-stats", "aggregator"],
    queryFn: () => profileStatsService.aggregator(),
  });
}

export function useCollectorStats() {
  return useQuery({
    queryKey: ["profile-stats", "collector"],
    queryFn: () => profileStatsService.collector(),
  });
}
