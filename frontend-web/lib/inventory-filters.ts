// Search, filters and sort for the aggregator's Browse GalleryZone page. The page already loads every
// reservable piece, so all of it is done here on that list, with no extra request. Pure, so
// inventory-filters.check.ts can run it under plain node: types only are imported.

import type { ArtworkRarity, ArtworkSizeBand } from "@/types/artwork";
import type { ReservableArtwork } from "@/services/aggregatorService";

export type InventorySort = "newest" | "price_asc" | "price_desc";

export interface PriceBand {
  min?: number;
  max?: number;
}

/** Same rupee bands as the marketplace's Price filter, applied to the price the aggregator sees on the card. */
export const INVENTORY_PRICE_BANDS: PriceBand[] = [
  { max: 10_000 },
  { min: 10_000, max: 25_000 },
  { min: 25_000, max: 50_000 },
  { min: 50_000, max: 100_000 },
  { min: 100_000 },
];

export interface InventoryFilters {
  /** The category chip. Null is "All". */
  category: string | null;
  mediums: string[];
  ranks: ArtworkRarity[];
  size: ArtworkSizeBand | null;
  /** Index into INVENTORY_PRICE_BANDS. */
  price: number | null;
  verifiedOnly: boolean;
  exclusiveOnly: boolean;
  /** The "Saved" chip: only pieces the aggregator has hearted. */
  savedOnly: boolean;
}

export const NO_FILTERS: InventoryFilters = {
  category: null,
  mediums: [],
  ranks: [],
  size: null,
  price: null,
  verifiedOnly: false,
  exclusiveOnly: false,
  savedOnly: false,
};

/** Slugs ("acrylic-on-canvas") and words ("Acrylic on Canvas") should find each other. */
const plain = (text: string | number | null | undefined): string =>
  String(text ?? "").replace(/[-_]+/g, " ").toLowerCase();

/** Every word typed has to appear somewhere in the piece's title, artist, medium, category, place or year. */
export function matchesQuery(artwork: ReservableArtwork, query: string): boolean {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [artwork.title, artwork.artistName, artwork.medium, artwork.category, artwork.artistLocation, artwork.yearCreated]
    .map(plain)
    .join(" ");
  return words.every((word) => haystack.includes(word));
}

export function inBand(price: number, { min, max }: PriceBand): boolean {
  return (min === undefined || price >= min) && (max === undefined || price < max);
}

function matchesFilters(artwork: ReservableArtwork, f: InventoryFilters, saved: ReadonlySet<string>): boolean {
  if (f.category !== null && artwork.category !== f.category) return false;
  if (f.mediums.length > 0 && !f.mediums.includes(artwork.medium)) return false;
  if (f.ranks.length > 0 && !(artwork.rarityType && f.ranks.includes(artwork.rarityType))) return false;
  if (f.size !== null && artwork.sizeBand !== f.size) return false;
  if (f.price !== null && !inBand(artwork.offer.offerPrice, INVENTORY_PRICE_BANDS[f.price] ?? {})) return false;
  if (f.verifiedOnly && !artwork.verifiedArtist) return false;
  if (f.exclusiveOnly && !artwork.exclusive) return false;
  if (f.savedOnly && !saved.has(artwork.id)) return false;
  return true;
}

/** "Newest" keeps the order the API sends, which is newest first. */
export function applyInventory(
  items: ReservableArtwork[],
  query: string,
  filters: InventoryFilters,
  sort: InventorySort,
  /** Ids on the aggregator's wishlist, for the Saved chip. */
  saved: ReadonlySet<string> = new Set(),
): ReservableArtwork[] {
  const kept = items.filter((artwork) => matchesQuery(artwork, query) && matchesFilters(artwork, filters, saved));
  if (sort === "price_asc") return kept.sort((a, b) => a.offer.offerPrice - b.offer.offerPrice);
  if (sort === "price_desc") return kept.sort((a, b) => b.offer.offerPrice - a.offer.offerPrice);
  return kept;
}

/** The Filters button's badge: everything set in the panel. The category and Saved chips show their own state. */
export function activeFilterCount(f: InventoryFilters): number {
  return f.mediums.length + f.ranks.length + (f.size ? 1 : 0) + (f.price !== null ? 1 : 0) + Number(f.verifiedOnly) + Number(f.exclusiveOnly);
}

export function isFiltering(query: string, f: InventoryFilters): boolean {
  return query.trim() !== "" || f.category !== null || f.savedOnly || activeFilterCount(f) > 0;
}

export interface InventoryFacets {
  categories: string[];
  mediums: [string, number][];
  ranks: Partial<Record<ArtworkRarity, number>>;
  sizes: Partial<Record<ArtworkSizeBand, number>>;
  prices: number[];
  verified: number;
  exclusive: number;
}

/** What is actually on the shelf, so no option in the panel leads to an empty page. */
export function inventoryFacets(items: ReservableArtwork[]): InventoryFacets {
  const mediums = new Map<string, number>();
  const categories = new Set<string>();
  const facets: InventoryFacets = { categories: [], mediums: [], ranks: {}, sizes: {}, prices: INVENTORY_PRICE_BANDS.map(() => 0), verified: 0, exclusive: 0 };
  for (const a of items) {
    if (a.category) categories.add(a.category);
    if (a.medium) mediums.set(a.medium, (mediums.get(a.medium) ?? 0) + 1);
    if (a.rarityType) facets.ranks[a.rarityType] = (facets.ranks[a.rarityType] ?? 0) + 1;
    if (a.sizeBand) facets.sizes[a.sizeBand] = (facets.sizes[a.sizeBand] ?? 0) + 1;
    INVENTORY_PRICE_BANDS.forEach((band, i) => {
      if (inBand(a.offer.offerPrice, band)) facets.prices[i]! += 1;
    });
    if (a.verifiedArtist) facets.verified += 1;
    if (a.exclusive) facets.exclusive += 1;
  }
  facets.categories = [...categories].sort();
  facets.mediums = [...mediums].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  return facets;
}
