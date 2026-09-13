import type { Artwork, ArtworkFilters, ArtworkSummary } from "@/types/artwork";
import type { ArtistProfile } from "@/types/artist";
import { http, isApiError } from "@/lib/api";
import {
  toArtistProfile,
  toArtwork,
  toArtworkSummary,
  type ArtistDto,
  type ArtworkDto,
} from "@/lib/api-mappers";
import { filterArtworks, sortArtworks, toSummary } from "@/lib/mock-data/helpers";

// Real implementation of the SAD §5.3 Page -> Hook -> Service -> API
// pattern. Only the method bodies changed from the mock phase — every hook
// (useArtworks/useArtwork/useArtistProfile) and every component stays
// untouched.
//
// The backend's GET /v1/artworks returns the whole marketplace (only
// pieces currently listed — status is projected server-side) with no
// filter/sort params yet, so filtering and sorting still happen here with
// the same helpers the mock used. Moving them server-side is a backend
// change with no frontend impact beyond this file.
export const artworkService = {
  async list(filters: ArtworkFilters): Promise<ArtworkSummary[]> {
    const { artworks } = await http.get<{ artworks: ArtworkDto[] }>("/v1/artworks");
    const filtered = filterArtworks(artworks.map(toArtwork), filters);
    return sortArtworks(filtered, filters.sortBy).map(toSummary);
  },

  // Full Artwork for the detail page; undefined when no artwork matches,
  // which callers (the Artwork Detail page) turn into notFound().
  async get(id: string): Promise<Artwork | undefined> {
    try {
      return toArtwork(await http.get<ArtworkDto>(`/v1/artworks/${encodeURIComponent(id)}`));
    } catch (error) {
      if (isApiError(error, 404)) return undefined;
      throw error;
    }
  },

  // "More from this artist" rail + the Artist Public Profile's listings
  // grid — the public summary shape, never full Artwork records.
  async listByArtist(artistId: string): Promise<ArtworkSummary[]> {
    const { artworks } = await http.get<{ artworks: ArtworkDto[] }>(
      `/v1/artists/${encodeURIComponent(artistId)}/artworks`,
    );
    return artworks.map(toArtworkSummary);
  },
};

export const artistService = {
  async get(id: string): Promise<ArtistProfile | undefined> {
    try {
      return toArtistProfile(await http.get<ArtistDto>(`/v1/artists/${encodeURIComponent(id)}`));
    } catch (error) {
      if (isApiError(error, 404)) return undefined;
      throw error;
    }
  },
};
