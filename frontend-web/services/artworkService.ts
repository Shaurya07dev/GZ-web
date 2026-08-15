import type { Artwork, ArtworkFilters, ArtworkSummary } from "@/types/artwork";
import type { ArtistProfile } from "@/types/artist";
import { mockDelay } from "@/lib/mock-utils";
import { artworksCol } from "@/lib/mock-collections";
import {
  filterArtworks,
  getArtistById,
  getArtworkById,
  getArtworksByArtist,
  sortArtworks,
  toSummary,
} from "@/lib/mock-data/helpers";

// Mock phase implementation of the SAD §5.3 Page -> Hook -> Service -> API
// pattern: every method below resolves fixture data through mockDelay
// instead of calling axios. When a real backend exists, only these method
// bodies change (e.g. list becomes `api.get('/marketplace', { params })`) -
// every hook in hooks/useArtworks.ts, hooks/useArtwork.ts, and
// hooks/useArtistProfile.ts, and every component that calls those hooks,
// stays untouched.
export const artworkService = {
  // Filter first, then sort the already-filtered set - mirrors how a real
  // backend applies WHERE before ORDER BY, and is cheaper than sorting the
  // full 18-artwork fixture set before narrowing it down. Results are
  // mapped to the public ArtworkSummary shape via toSummary() (Task 2),
  // which is also where the artist_price confidentiality rule is
  // structurally enforced - this list is never returned as full Artwork
  // records.
  list(filters: ArtworkFilters): Promise<ArtworkSummary[]> {
    const filtered = filterArtworks(artworksCol.get(), filters);
    const sorted = sortArtworks(filtered, filters.sortBy);
    return mockDelay(sorted.map(toSummary));
  },

  // Returns the full Artwork (detail page needs description, images,
  // COA, statusHistory, etc.) - undefined when no artwork matches, which
  // callers (the Artwork Detail page) turn into notFound().
  get(id: string): Promise<Artwork | undefined> {
    return mockDelay(getArtworkById(id));
  },

  // "More from this artist" rail + the Artist Public Profile's listings
  // grid both need the public summary shape, not full Artwork records.
  listByArtist(artistId: string): Promise<ArtworkSummary[]> {
    return mockDelay(getArtworksByArtist(artistId).map(toSummary));
  },
};

// Small enough to live alongside artworkService per Task 13's interface -
// the Artist Public Profile and Artwork Detail pages both need a single
// artist lookup, and there's no other artist-domain service call in this
// track that would justify a separate file.
export const artistService = {
  get(id: string): Promise<ArtistProfile | undefined> {
    return mockDelay(getArtistById(id));
  },
};
