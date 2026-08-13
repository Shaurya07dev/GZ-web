import type { AggregatorHolding, RecordSalePayload } from "@/types/aggregator";
import type { ArtworkSummary } from "@/types/artwork";
import { mockArtworks } from "@/lib/mock-data/artworks";
import { mockAggregatorHoldings } from "@/lib/mock-data/aggregator-holdings";
import { getArtworkById, toSummary } from "@/lib/mock-data/helpers";
import { mockDelay, mockError } from "@/lib/mock-utils";

// ---------------------------------------------------------------------------
// Business rules (chosen and documented once here, applied consistently
// everywhere this service is the source of truth: dashboard KPI math, the
// inventory reserve flow, and the collection display).
// ---------------------------------------------------------------------------

// Advance-percent rule for NEW reservations made through reserve() below.
// SAD §2.7 confirms advance_percent is always 5.00 or 3.00 but does not
// specify the split rule, and the already-seeded holdings
// (lib/mock-data/aggregator-holdings.ts) intentionally mix both without a
// strict price threshold (real advance terms likely depend on factors this
// mock doesn't model, e.g. category or negotiated terms). For reservations
// created going forward, we pick one simple, consistent rule so the mock
// behaves predictably: 5% under ₹25,000, 3% at or above.
const ADVANCE_THRESHOLD = 25_000;

// Exported (not just used internally by reserve() below) so
// ReserveArtworkDialog (Task 23) can preview the exact advance percent/
// amount a confirm click will produce, without duplicating the rule or
// waiting on a round trip to find out.
export function advancePercentFor(customerPrice: number): 5 | 3 {
  return customerPrice < ADVANCE_THRESHOLD ? 5 : 3;
}

export function advanceAmountFor(
  customerPrice: number,
  advancePercent: 5 | 3,
): number {
  return Math.round((advancePercent / 100) * customerPrice);
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// In-memory "database" for this mock service. Starts as a copy of the seeded
// fixture and is mutated by reserve()/recordSale()/updateDisplayPrice() so
// the portal behaves like a real, stateful backend across a session (an
// artwork reserved via the Inventory page actually disappears from
// inventory and actually shows up in Collection, etc). This intentionally
// does NOT mutate the shared mockArtworks array from lib/mock-data/ — that
// fixture is read-only, shared with the Marketplace track, and mutating it
// in place would leak side effects into pages this track doesn't own.
// Consequence: an artwork's own `status` field stays whatever Task 2 seeded
// (e.g. "marketplace") even after this service reserves it — every check in
// this file and in the Aggregator Portal's pages treats `holdings` (not
// artwork.status) as the real source of truth for what's reserved/sold, so
// that's fully consistent within this track. Resets on server restart /
// module reload, same as every other mock service in this codebase.
let holdings: AggregatorHolding[] = [...mockAggregatorHoldings];
let nextHoldingSeq = holdings.length + 1;

function withArtwork(
  holding: AggregatorHolding,
): AggregatorHolding & { artwork: ArtworkSummary } {
  const artwork = getArtworkById(holding.artworkId);
  if (!artwork) {
    throw new Error(
      `aggregatorService: holding "${holding.id}" references missing artwork "${holding.artworkId}"`,
    );
  }
  return { ...holding, artwork: toSummary(artwork) };
}

export const aggregatorService = {
  // Reservable = eligible for aggregator display, still on the open
  // marketplace, and not already claimed by any holding (reserved or
  // already sold_pending_settlement) — checked against the live `holdings`
  // store, not the frozen fixture, so a just-reserved artwork can never be
  // reserved twice in the same session.
  listReservableInventory(): Promise<ArtworkSummary[]> {
    const claimedArtworkIds = new Set(holdings.map((h) => h.artworkId));
    const reservable = mockArtworks.filter(
      (artwork) =>
        artwork.listingType === "marketplace_and_aggregator" &&
        artwork.status === "marketplace" &&
        !claimedArtworkIds.has(artwork.id),
    );
    return mockDelay(reservable.map(toSummary));
  },

  // simulateConflict mirrors the real, documented 409 race condition (SAD
  // §3.5: "Response 409 Conflict (lost the race to another aggregator)")
  // rather than an invented error path.
  reserve(
    artworkId: string,
    simulateConflict = false,
  ): Promise<AggregatorHolding> {
    if (simulateConflict) {
      return mockError("Artwork no longer available");
    }

    const artwork = getArtworkById(artworkId);
    const alreadyClaimed = holdings.some((h) => h.artworkId === artworkId);
    if (!artwork || alreadyClaimed) {
      return mockError("Artwork no longer available");
    }

    const advancePercent = advancePercentFor(artwork.customerPrice);
    const assignedAt = new Date();
    const expiresAt = new Date(assignedAt.getTime() + THIRTY_DAYS_MS);

    const holding: AggregatorHolding = {
      id: `hold-${nextHoldingSeq++}`,
      artworkId,
      advancePercent,
      advanceAmount: advanceAmountFor(artwork.customerPrice, advancePercent),
      displayPrice: artwork.customerPrice, // floor, per SAD §2.7 — see edit-display-price-dialog.tsx (Task 24) for the raise-only enforcement
      assignedAt: assignedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: "reserved",
    };
    holdings = [...holdings, holding];
    return mockDelay(holding);
  },

  listCollection(): Promise<
    Array<AggregatorHolding & { artwork: ArtworkSummary }>
  > {
    return mockDelay(holdings.map(withArtwork));
  },

  // Matches POST /aggregators/sale (SAD §3.5): moves the matching *active*
  // holding to sold_pending_settlement rather than removing it, so it stays
  // visible (and editable-price-locked) in the Collection table per spec §7.
  recordSale(payload: RecordSalePayload): Promise<AggregatorHolding> {
    const index = holdings.findIndex(
      (h) => h.artworkId === payload.artworkId && h.status === "reserved",
    );
    if (index === -1) {
      return mockError("No active reservation found for this artwork");
    }
    const updated: AggregatorHolding = {
      ...holdings[index],
      status: "sold_pending_settlement",
    };
    holdings = holdings.map((h, i) => (i === index ? updated : h));
    return mockDelay(updated);
  },

  // Synchronous, deliberately not a mockDelay-wrapped async mutation: Task
  // 24's EditDisplayPriceDialog only needs to update local state (a single
  // number) and does so via queryClient.setQueryData for instant UI
  // feedback. This method exists purely so that update also lands in this
  // service's own in-memory store — without it, the next unrelated
  // ["aggregator-collection"] refetch (e.g. after recording a sale on a
  // different holding) would silently revert the edited price back to
  // whatever this service last held, since setQueryData alone never tells
  // the "server" about the change.
  updateDisplayPrice(
    holdingId: string,
    displayPrice: number,
  ): AggregatorHolding {
    const index = holdings.findIndex((h) => h.id === holdingId);
    if (index === -1) {
      throw new Error(`aggregatorService: no holding "${holdingId}"`);
    }
    const updated: AggregatorHolding = { ...holdings[index], displayPrice };
    holdings = holdings.map((h, i) => (i === index ? updated : h));
    return updated;
  },

  // KPI derivation. Advance payments are collected at reservation time, not
  // earned commission (that's realized on sale) — see the Onboarding
  // Guide's "20% of the 30% markup" worked example (₹30,000 listed →
  // ₹9,000 platform markup → ₹1,800 aggregator share). This mock layer
  // deliberately never carries the private artist_price field (Global
  // Constraints), so there's no platform markup figure to take 20% of
  // directly. The equivalent figure available here is the aggregator's own
  // markup over the customerPrice floor (displayPrice - customerPrice) —
  // commissionEarned is 20% of that, summed only across holdings that have
  // actually sold. A holding sold at exactly the floor price (displayPrice
  // === customerPrice, never raised) contributes ₹0, which is the correct,
  // honest result of this formula, not a bug.
  dashboardSummary(): Promise<{
    activeReservations: number;
    commissionEarned: number;
    pendingSettlements: number;
  }> {
    const activeReservations = holdings.filter(
      (h) => h.status === "reserved",
    ).length;
    const soldHoldings = holdings.filter(
      (h) => h.status === "sold_pending_settlement",
    );
    const pendingSettlements = soldHoldings.length;
    const commissionEarned = soldHoldings.reduce((sum, holding) => {
      const artwork = getArtworkById(holding.artworkId);
      if (!artwork) return sum;
      const aggregatorMarkup = Math.max(
        0,
        holding.displayPrice - artwork.customerPrice,
      );
      return sum + 0.2 * aggregatorMarkup;
    }, 0);

    return mockDelay({
      activeReservations,
      commissionEarned: Math.round(commissionEarned),
      pendingSettlements,
    });
  },
};
