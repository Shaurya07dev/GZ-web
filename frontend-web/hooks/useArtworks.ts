import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { artworkService } from "@/services/artworkService";
import type { ArtworkFilters, MarketplaceFacets } from "@/types/artwork";

// Query key convention per SAD §5.4: ['artworks', filters]. `filters` is a
// plain object (category/price/medium/query/sortBy/page), which TanStack
// Query hashes structurally, so a new filters object with the same values
// on every render still hits the same cache entry. The previous page stays
// on screen while the next one loads, so paging never flashes skeletons.
export function useArtworks(filters: ArtworkFilters) {
  return useQuery({
    queryKey: ["artworks", filters],
    queryFn: () => artworkService.list(filters),
    placeholderData: keepPreviousData,
  });
}

// The unfiltered first page — its facets drive the filter sidebar (distinct
// values across the whole live marketplace, so no option is a dead end and
// nothing is hardcoded) and its artworks give the quick-category chips a
// real thumbnail. Cached separately from any filtered listing.
export function useMarketplaceOverview() {
  return useQuery({
    queryKey: ["artworks", "overview"],
    queryFn: () => artworkService.list({}),
    staleTime: 60_000,
  });
}

const EMPTY_FACETS: MarketplaceFacets = { categories: [], mediums: [], rarities: [], rarityCounts: {}, locations: [], artists: [], priceRange: null };

export function useMarketplaceFacets(): MarketplaceFacets {
  return useMarketplaceOverview().data?.facets ?? EMPTY_FACETS;
}
