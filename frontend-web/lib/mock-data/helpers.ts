import type { Artwork, ArtworkFilters, ArtworkSummary } from "@/types/artwork";
import type { ArtistProfile } from "@/types/artist";
import { mockArtworks } from "./artworks";
import { mockArtists } from "./artists";

export function getArtworkById(id: string): Artwork | undefined {
  return mockArtworks.find((artwork) => artwork.id === id);
}

export function getArtworksByArtist(artistId: string): Artwork[] {
  return mockArtworks.filter((artwork) => artwork.artistId === artistId);
}

export function getArtistById(id: string): ArtistProfile | undefined {
  return mockArtists.find((artist) => artist.id === id);
}

// Strips an Artwork down to the public list-item shape. This is also where
// the artist_price confidentiality rule is structurally enforced: Artwork
// never carries an artistPrice field in the first place (see
// types/artwork.ts), so there is nothing here that could leak it — the only
// price this function (or anything downstream of it) can ever touch is
// customerPrice.
export function toSummary(artwork: Artwork): ArtworkSummary {
  const {
    id,
    title,
    artistId,
    artistName,
    verifiedArtist,
    category,
    medium,
    customerPrice,
    thumbnailUrl,
    insured,
    status,
    listingType,
  } = artwork;
  return {
    id,
    title,
    artistId,
    artistName,
    verifiedArtist,
    category,
    medium,
    customerPrice,
    thumbnailUrl,
    insured,
    status,
    listingType,
  };
}

export function filterArtworks(artworks: Artwork[], filters: ArtworkFilters): Artwork[] {
  const query = filters.query?.trim().toLowerCase();

  return artworks.filter((artwork) => {
    if (filters.category && artwork.category !== filters.category) return false;
    if (filters.medium && artwork.medium !== filters.medium) return false;
    if (typeof filters.minPrice === "number" && artwork.customerPrice < filters.minPrice) return false;
    if (typeof filters.maxPrice === "number" && artwork.customerPrice > filters.maxPrice) return false;

    if (query) {
      const haystack = `${artwork.title} ${artwork.artistName} ${artwork.category} ${artwork.medium} ${artwork.description}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

// "Newest" is by listing date, not creation date — there's no dedicated
// listedAt field, so it's read off the artwork's own append-only
// statusHistory (the changedAt of its "marketplace" transition), falling
// back to the earliest recorded event for the rare artwork that doesn't
// have one yet.
function listedAt(artwork: Artwork): string {
  const listedEvent = artwork.statusHistory.find((event) => event.status === "marketplace");
  return listedEvent?.changedAt ?? artwork.statusHistory[0]?.changedAt ?? "";
}

export function sortArtworks(artworks: Artwork[], sortBy: ArtworkFilters["sortBy"]): Artwork[] {
  const sorted = [...artworks];

  switch (sortBy) {
    case "price_asc":
      sorted.sort((a, b) => a.customerPrice - b.customerPrice);
      break;
    case "price_desc":
      sorted.sort((a, b) => b.customerPrice - a.customerPrice);
      break;
    case "newest":
    default:
      sorted.sort((a, b) => listedAt(b).localeCompare(listedAt(a)));
      break;
  }

  return sorted;
}
