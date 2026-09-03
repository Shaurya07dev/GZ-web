import {
  isMarketplaceListed,
  type Artwork,
  type ArtworkFilters,
  type ArtworkSizeBand,
  type ArtworkSummary,
} from "@/types/artwork";
import type { ArtistProfile } from "@/types/artist";
import { mockArtists } from "./artists";
// Reads the LIVE artworks collection (lib/mock-collections.ts), not the
// frozen `mockArtworks` fixture import — an artwork an admin just approved
// only exists in that live collection, so every lookup through this file
// (artworkService, aggregatorService, adminService) needs to see it too.
import { artworksCol } from "@/lib/mock-collections";

export function getArtworkById(id: string): Artwork | undefined {
  return artworksCol.get().find((artwork) => artwork.id === id);
}

export function getArtworksByArtist(artistId: string): Artwork[] {
  return artworksCol
    .get()
    .filter(
      (artwork) => artwork.artistId === artistId && isPubliclyListed(artwork),
    );
}

// One gate for every public listing surface (marketplace grid, artist page
// rails). Aggregator-only pieces are sold through partner premises and never
// appear in the online store; a piece the artist sold elsewhere leaves every
// channel at once. Direct lookups by id (getArtworkById) deliberately skip
// this — a passport/COA link must still resolve after the piece is gone.
function isPubliclyListed(artwork: Artwork): boolean {
  return (
    isMarketplaceListed(artwork.listingType) &&
    artwork.status !== "sold_externally"
  );
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
    rarityType,
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
    rarityType: rarityType ?? null,
  };
}

// Buckets a stored "24 x 36 in" / "60 x 90 cm" dimensions string by area, in
// square inches, so Small/Medium/Large stays comparable across units. Only
// the first two numbers count — depth (a sculpture's third figure) doesn't
// change how big a piece reads on a wall. No dimensions on record means no
// bucket, which the Size filter treats as "doesn't match any band" rather
// than guessing.
export function sizeBucketOf(
  dimensions: string | null,
): ArtworkSizeBand | null {
  if (!dimensions) return null;
  const match = dimensions
    .trim()
    .match(/^([\d.]+)\s*x\s*([\d.]+)(?:\s*x\s*[\d.]+)?\s*(in|cm)$/i);
  if (!match) return null;

  const [, rawWidth, rawHeight, unit] = match;
  const toInches = unit!.toLowerCase() === "cm" ? 1 / 2.54 : 1;
  const areaSqIn = Number(rawWidth) * toInches * (Number(rawHeight) * toInches);

  if (areaSqIn <= 400) return "small";
  if (areaSqIn <= 900) return "medium";
  return "large";
}

export function filterArtworks(
  artworks: Artwork[],
  filters: ArtworkFilters,
): Artwork[] {
  const query = filters.query?.trim().toLowerCase();

  return artworks.filter((artwork) => {
    if (!isPubliclyListed(artwork)) return false;
    if (filters.category && artwork.category !== filters.category) return false;
    if (filters.medium && artwork.medium !== filters.medium) return false;
    if (filters.rarity && artwork.rarityType !== filters.rarity) return false;
    if (filters.artistId && artwork.artistId !== filters.artistId)
      return false;
    if (
      filters.location &&
      getArtistById(artwork.artistId)?.location !== filters.location
    )
      return false;
    if (filters.size && sizeBucketOf(artwork.dimensions) !== filters.size)
      return false;
    if (
      filters.availability === "available" &&
      artwork.status !== "marketplace"
    )
      return false;
    if (
      filters.availability === "unavailable" &&
      artwork.status === "marketplace"
    )
      return false;
    if (
      typeof filters.minPrice === "number" &&
      artwork.customerPrice < filters.minPrice
    )
      return false;
    if (
      typeof filters.maxPrice === "number" &&
      artwork.customerPrice > filters.maxPrice
    )
      return false;

    if (query) {
      const haystack =
        `${artwork.title} ${artwork.artistName} ${artwork.category} ${artwork.medium} ${artwork.description}`.toLowerCase();
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
  const listedEvent = artwork.statusHistory.find(
    (event) => event.status === "marketplace",
  );
  return listedEvent?.changedAt ?? artwork.statusHistory[0]?.changedAt ?? "";
}

export function sortArtworks(
  artworks: Artwork[],
  sortBy: ArtworkFilters["sortBy"],
): Artwork[] {
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
