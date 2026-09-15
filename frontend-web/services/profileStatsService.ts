import type {
  AggregatorStats,
  ArtistPrivateStats,
  ArtistPublicStats,
  CollectorStats,
  PriceRange,
} from "@/types/profile-stats";
import type { Artwork } from "@/types/artwork";
import { verifiedTierCount } from "@/types/artist";
import { mockDelay } from "@/lib/mock-utils";
import {
  aggregatorGallerySpacesCol,
  aggregatorSalesCol,
  aggregatorProfileCol,
  aggregatorWalletCol,
  artworksCol,
  holdingsCol,
} from "@/lib/mock-collections";
import { aggregatorCommissionOf } from "@/lib/pricing";
import { artistPriceOf } from "./artistPayoutService";
import { artistService, artworkService } from "./artworkService";
import { artistRatingService } from "./artistRatingService";
import { artistArtworkApi } from "./artistArtworkApi";
import { artistWalletApi } from "./artistWalletApi";
import { customerCollectionService } from "./customerCollectionService";
import { orderService } from "./orderService";
import { customerService } from "./customerService";

// Everything a profile shows at a glance, derived on read from the collections
// that already hold the truth. Nothing here is stored, so a stat cannot drift
// from the thing it counts — the failure mode of every "denormalised counter"
// is that it is wrong and nobody notices for months.
//
// The privacy line from types/profile-stats.ts is enforced here: artistPublic()
// never touches artistPricesCol or the wallet, artistPrivate() is the only
// function that does, and they are separate calls so a component cannot get
// the second by asking for the first.

/** Statuses that mean a piece has left the artist's hands for good. */
const SOLD_STATUSES = new Set([
  "sold",
  "settlement_complete",
  "delivered",
  "completed",
]);

function isSold(artwork: Artwork): boolean {
  return SOLD_STATUSES.has(artwork.status);
}

/** Most-frequent first, so "what do they mostly do" reads off the front. */
function byFrequency(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value]) => value);
}

function rangeOf(amounts: number[]): PriceRange | null {
  if (amounts.length === 0) return null;
  return { low: Math.min(...amounts), high: Math.max(...amounts) };
}

// --- Artist ------------------------------------------------------------------

async function artistPublic(artistId: string): Promise<ArtistPublicStats> {
  const [profile, listed, rating] = await Promise.all([
    artistService.get(artistId),
    artworkService.listByArtist(artistId),
    artistRatingService.getRating(artistId),
  ]);
  return {
    artworksListed: listed.length,
    // Sold / on-display counts need the artist's private list; publicly we only see live pieces.
    worksSold: 0,
    onDisplay: 0,
    mediums: byFrequency(listed.map((a) => a.medium)),
    categories: byFrequency(listed.map((a) => a.category)),
    listedPriceRange: rangeOf(listed.map((a) => a.customerPrice)),
    rating,
    connections: 0,
    joinedAt: profile?.joinedAt ?? "",
    verifiedTiers: profile ? verifiedTierCount(profile.verification) : 0,
  };
}

async function artistPrivate(): Promise<ArtistPrivateStats> {
  const [mine, wallet, transactions] = await Promise.all([artistArtworkApi.list(), artistWalletApi.getWallet(), artistWalletApi.listTransactions()]);
  const settlements = transactions.filter((t) => t.type === "settlement" && t.status === "completed").map((t) => t.amount);
  const soldCount = mine.filter((a) => ["sold", "settlement_complete", "delivered", "completed"].includes(a.status)).length;
  return {
    lifetimeEarnings: settlements.reduce((sum, v) => sum + v, 0),
    pendingEarnings: wallet.lockedBalance,
    averageSalePrice: settlements.length ? Math.round(settlements.reduce((sum, v) => sum + v, 0) / settlements.length) : (soldCount ? 0 : 0),
    awaitingReview: mine.filter((a) => a.status === "pending_approval").length,
    drafts: mine.filter((a) => a.status === "draft").length,
  };
}

function aggregator(): AggregatorStats {
  const holdings = holdingsCol.get();
  const sales = aggregatorSalesCol.get();
  const spaces = aggregatorGallerySpacesCol.get();
  const wallet = aggregatorWalletCol.get();
  const profile = aggregatorProfileCol.get();
  const artworks = artworksCol.get();

  const commissionEarned = holdings
    .filter((h) => h.status === "sold_pending_settlement")
    .reduce((sum, holding) => {
      const artwork = artworks.find((a) => a.id === holding.artworkId);
      if (!artwork) return sum;
      return sum + aggregatorCommissionOf(holding.displayPrice, artistPriceOf(artwork));
    }, 0);

  return {
    onDisplay: holdings.filter((h) => h.status === "reserved").length,
    piecesSold: holdings.filter((h) => h.status === "sold_pending_settlement")
      .length,
    returned: holdings.filter((h) => h.status === "returned").length,
    commissionEarned: Math.round(commissionEarned),
    heldAgainstReservations: wallet.lockedBalance,
    // The whole sale price, never the sale less commission — the aggregator
    // collects on GalleryZone's behalf and settles their cut separately.
    owedToGalleryZone: sales
      .filter((s) => s.paymentRoute === "cash_at_premises" && !s.remittedAt)
      .reduce((sum, sale) => sum + sale.soldPrice, 0),
    gallerySpaces: spaces.length,
    displayCapacity: spaces.reduce((sum, space) => sum + space.capacity, 0),
    cities: byFrequency(spaces.map((space) => space.city)),
    distinctBuyers: new Set(sales.map((s) => s.buyerEmail)).size,
    mouSignedAt: profile.mouAcceptance?.acceptedAt ?? null,
  };
}

// --- Collector ----------------------------------------------------------------

async function collector(): Promise<CollectorStats> {
  const [collection, orders, profile] = await Promise.all([customerCollectionService.list(), orderService.list(), customerService.getProfile()]);
  const open = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled" && o.status !== "pending");
  const counts = new Map<string, number>();
  for (const item of collection) counts.set(item.artwork.artistName, (counts.get(item.artwork.artistName) ?? 0) + 1);
  return {
    worksOwned: collection.length,
    ordersPlaced: orders.filter((o) => o.status !== "pending").length,
    inProgress: open.length,
    totalSpent: orders.filter((o) => o.status !== "pending" && o.status !== "cancelled").reduce((sum, o) => sum + o.amount + o.deliveryCharge, 0),
    wishlisted: 0,
    listedForResale: 0,
    artistsCollected: [...counts.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).map(([name]) => name),
    walletBalance: 0,
    joinedAt: profile.joinedAt,
  };
}

export const profileStatsService = {
  artistPublic: (artistId: string): Promise<ArtistPublicStats> => artistPublic(artistId),

  artistPrivate: (_artistId: string): Promise<ArtistPrivateStats> => artistPrivate(),

  aggregator: (): Promise<AggregatorStats> => mockDelay(aggregator()),

  collector: (): Promise<CollectorStats> => collector(),
};
