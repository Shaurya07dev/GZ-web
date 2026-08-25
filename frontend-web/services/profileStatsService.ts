import type {
  AggregatorStats,
  ArtistPrivateStats,
  ArtistPublicStats,
  CollectorStats,
  PriceRange,
} from "@/types/profile-stats";
import type { Artwork } from "@/types/artwork";
import { verifiedTierCount } from "@/types/artist";
import { summarizeRating } from "@/types/artist-rating";
import { involvesArtist } from "@/types/artist-network";
import { mockDelay } from "@/lib/mock-utils";
import { getArtistById } from "@/lib/mock-data/helpers";
import { ARTIST } from "@/features/dashboard/dashboard-data";
import {
  CURRENT_ARTIST_ID,
  aggregatorGallerySpacesCol,
  aggregatorSalesCol,
  aggregatorProfileCol,
  aggregatorWalletCol,
  artistCollaborationsCol,
  artistConnectionsCol,
  artistPricesCol,
  artistReviewsCol,
  artistWalletCol,
  artworksCol,
  customerProfileCol,
  customerResaleListingsCol,
  customerWalletCol,
  holdingsCol,
  ordersCol,
  pendingArtworksCol,
} from "@/lib/mock-collections";
import { aggregatorCommissionOf } from "@/lib/pricing";
import { artistPriceOf } from "./artistPayoutService";

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

function artistPublic(artistId: string): ArtistPublicStats {
  const identity = artistIdentity(artistId);
  const mine = artworksCol.get().filter((a) => a.artistId === artistId);
  const listed = mine.filter((a) => a.status === "marketplace");
  const sold = mine.filter(isSold);

  const connections = artistConnectionsCol
    .get()
    .filter((c) => involvesArtist(c, artistId) && c.status === "accepted");
  const collaborations = artistCollaborationsCol
    .get()
    .filter(
      (c) =>
        (c.proposerId === artistId || c.partnerId === artistId) &&
        c.status === "completed",
    );

  return {
    artworksListed: listed.length,
    worksSold: sold.length,
    onDisplay: mine.filter((a) => a.status === "with_aggregator").length,
    mediums: byFrequency(mine.map((a) => a.medium)),
    categories: byFrequency(mine.map((a) => a.category)),
    // The customer-facing price, which is on every artwork card already. The
    // artist's own price is not derivable from a range of markups.
    listedPriceRange: rangeOf(listed.map((a) => a.customerPrice)),
    rating: summarizeRating(artistId, artistReviewsCol.get()),
    connections: connections.length,
    collaborations: collaborations.length,
    joinedAt: identity.joinedAt,
    verifiedTiers: identity.verifiedTiers,
  };
}

/**
 * Who this artist is, for the two fields that come from a profile record
 * rather than from their work.
 *
 * The demo artist is the awkward case: she is the signed-in user, so she has a
 * dashboard record (ARTIST) but is deliberately not one of the seven public
 * fixtures. Falling through to `new Date()` for her made her look like she
 * joined today, on her own profile, every day.
 */
function artistIdentity(artistId: string): {
  joinedAt: string;
  verifiedTiers: 0 | 1 | 2 | 3;
} {
  const known = getArtistById(artistId);
  if (known) {
    return {
      joinedAt: known.joinedAt,
      verifiedTiers: verifiedTierCount(known.verification),
    };
  }
  if (artistId === CURRENT_ARTIST_ID) {
    return {
      joinedAt: ARTIST.joinedAt,
      verifiedTiers: Math.min(3, Math.max(0, ARTIST.verifiedTier)) as 0 | 1 | 2 | 3,
    };
  }
  return { joinedAt: new Date().toISOString(), verifiedTiers: 0 };
}

function artistPrivate(artistId: string): ArtistPrivateStats {
  const mine = artworksCol.get().filter((a) => a.artistId === artistId);
  const sold = mine.filter(isSold);
  const prices = artistPricesCol.get();
  const wallet = artistWalletCol.get();

  // What they were actually paid, not what the buyer paid. Falls back through
  // artistPriceOf for fixture pieces with no stored price.
  const takeHome = sold.map((a) => prices[a.id] ?? artistPriceOf(a));
  const total = takeHome.reduce((sum, amount) => sum + amount, 0);

  return {
    lifetimeEarnings: wallet.balance,
    pendingEarnings: wallet.pendingBalance,
    averageSalePrice:
      takeHome.length === 0 ? 0 : Math.round(total / takeHome.length),
    awaitingReview: pendingArtworksCol
      .get()
      .filter((a) => a.artistId === artistId).length,
    drafts: mine.filter((a) => a.status === "draft").length,
  };
}

// --- Aggregator ---------------------------------------------------------------

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

function collector(): CollectorStats {
  const orders = ordersCol.get();
  const artworks = artworksCol.get();
  const profile = customerProfileCol.get();

  const delivered = orders.filter((o) => o.status === "delivered");
  const open = orders.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled",
  );

  // Who they keep coming back to. One purchase is a purchase; two is a taste.
  const artistNames = delivered
    .map((order) => artworks.find((a) => a.id === order.artworkId)?.artistName)
    .filter((name): name is string => Boolean(name));
  const counts = new Map<string, number>();
  for (const name of artistNames) counts.set(name, (counts.get(name) ?? 0) + 1);

  return {
    worksOwned: delivered.length,
    ordersPlaced: orders.length,
    inProgress: open.length,
    // GST is inside the amount and delivery is added — the same total the
    // buyer was actually charged (lib/pricing.ts).
    totalSpent: delivered.reduce(
      (sum, order) => sum + order.amount + order.deliveryCharge,
      0,
    ),
    // Wishlist lives in a client-only zustand store, so it is passed in by the
    // component that can read it rather than guessed at here.
    wishlisted: 0,
    listedForResale: customerResaleListingsCol
      .get()
      .filter((l) => l.status === "active").length,
    artistsCollected: [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name),
    walletBalance: customerWalletCol.get().balance,
    joinedAt: profile.joinedAt,
  };
}

export const profileStatsService = {
  artistPublic: (artistId: string): Promise<ArtistPublicStats> =>
    mockDelay(artistPublic(artistId)),

  /** Server components read this directly — no round trip to render a page. */
  artistPublicSync: artistPublic,

  artistPrivate: (artistId: string): Promise<ArtistPrivateStats> =>
    mockDelay(artistPrivate(artistId)),

  aggregator: (): Promise<AggregatorStats> => mockDelay(aggregator()),

  collector: (): Promise<CollectorStats> => mockDelay(collector()),
};
