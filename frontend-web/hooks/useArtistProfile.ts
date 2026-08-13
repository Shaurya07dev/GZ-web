import { useQuery } from "@tanstack/react-query";
import { artistService, artworkService } from "@/services/artworkService";

// Query key convention per SAD §5.4, extended to the artist domain the same
// way ['artworks', filters] / ['artwork', id] are named: domain noun first,
// then the identifying param.
export function useArtistProfile(id: string) {
  return useQuery({
    queryKey: ["artist", id],
    queryFn: () => artistService.get(id),
    enabled: Boolean(id),
  });
}

// Colocated with useArtistProfile (rather than hooks/useArtworks.ts)
// because every call site that needs an artist's listed artworks -
// the Artwork Detail "more from this artist" rail and the Artist Public
// Profile's listings grid - fetches it alongside useArtistProfile itself.
export function useArtistArtworks(id: string) {
  return useQuery({
    queryKey: ["artist-artworks", id],
    queryFn: () => artworkService.listByArtist(id),
    enabled: Boolean(id),
  });
}
