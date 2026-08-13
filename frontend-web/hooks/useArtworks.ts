import { useQuery } from "@tanstack/react-query";
import { artworkService } from "@/services/artworkService";
import type { ArtworkFilters } from "@/types/artwork";

// Query key convention per SAD §5.4: ['artworks', filters]. `filters` is a
// plain object (category/price/medium/query/sortBy), which TanStack Query
// hashes structurally, so a new filters object with the same values on
// every render still hits the same cache entry.
export function useArtworks(filters: ArtworkFilters) {
  return useQuery({
    queryKey: ["artworks", filters],
    queryFn: () => artworkService.list(filters),
  });
}
