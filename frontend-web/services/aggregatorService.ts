import type {
  AggregatorHolding,
  AggregatorSale,
  RecordSalePayload,
} from "@/types/aggregator";
import type { ArtworkSummary } from "@/types/artwork";
import { getArtworkById, toSummary } from "@/lib/mock-data/helpers";
import { mockDelay, mockError } from "@/lib/mock-utils";
import {
  artworksCol,
  holdingsCol,
  aggregatorSalesCol,
  aggregatorWalletCol,
  aggregatorWalletTransactionsCol,
} from "@/lib/mock-collections";

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
// ReserveArtworkDialog can preview the exact advance percent/amount a
// confirm click will produce, without duplicating the rule or waiting on a
// round trip to find out.
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

// Holdings are backed by lib/mock-db.ts via holdingsCol (lib/mock-collections.ts)
// so reserve()/recordSale()/updateDisplayPrice() survive a refresh and are
// visible across tabs/portals — an artwork reserved via Inventory actually
// disappears from inventory and shows up in Collection, for good. This
// intentionally does NOT mutate the shared `artworksCol` records — that
// collection is shared with the Marketplace/Admin tracks, and mutating it in
// place would leak side effects into pages this track doesn't own.
// Consequence: an artwork's own `status` field stays "marketplace" even
// after this service reserves it — every check in this file and in the
// Aggregator Portal's pages treats `holdings` (not artwork.status) as the
// real source of truth for what's reserved/sold.
function nextHoldingId(current: AggregatorHolding[]): string {
  return `hold-${current.length + 1}-${Date.now().toString(36)}`;
}

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
  // store, not a frozen fixture, so a just-reserved artwork can never be
  // reserved twice.
  listReservableInventory(): Promise<ArtworkSummary[]> {
    const claimedArtworkIds = new Set(
      holdingsCol.get().map((h) => h.artworkId),
    );
    const reservable = artworksCol
      .get()
      .filter(
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
    const holdings = holdingsCol.get();
    const alreadyClaimed = holdings.some((h) => h.artworkId === artworkId);
    if (!artwork || alreadyClaimed) {
      return mockError("Artwork no longer available");
    }

    const advancePercent = advancePercentFor(artwork.customerPrice);
    const assignedAt = new Date();
    const expiresAt = new Date(assignedAt.getTime() + THIRTY_DAYS_MS);

    const holding: AggregatorHolding = {
      id: nextHoldingId(holdings),
      artworkId,
      advancePercent,
      advanceAmount: advanceAmountFor(artwork.customerPrice, advancePercent),
      displayPrice: artwork.customerPrice, // floor, per SAD §2.7 — see edit-display-price-dialog.tsx for the raise-only enforcement
      assignedAt: assignedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: "reserved",
      assignmentSource: "self_reserved",
    };
    holdingsCol.set([...holdings, holding]);
    return mockDelay(holding);
  },

  listCollection(): Promise<
    Array<AggregatorHolding & { artwork: ArtworkSummary }>
  > {
    return mockDelay(holdingsCol.get().map(withArtwork));
  },

  // Matches POST /aggregators/sale (SAD §3.5): moves the matching *active*
  // holding to sold_pending_settlement rather than removing it, so it stays
  // visible (and editable-price-locked) in the Collection table. Also persists
  // the AggregatorSale row and credits pending wallet commission at the same
  // 20%-of-markup rate dashboardSummary() uses.
  recordSale(payload: RecordSalePayload): Promise<AggregatorHolding> {
    const holdings = holdingsCol.get();
    const index = holdings.findIndex(
      (h) => h.artworkId === payload.artworkId && h.status === "reserved",
    );
    if (index === -1) {
      return mockError("No active reservation found for this artwork");
    }
    const holding = holdings[index];
    const updated: AggregatorHolding = {
      ...holding,
      status: "sold_pending_settlement",
    };
    holdingsCol.set(holdings.map((h, i) => (i === index ? updated : h)));

    const now = new Date().toISOString();
    const sale: AggregatorSale = {
      id: `sale-${crypto.randomUUID().slice(0, 8)}`,
      holdingId: holding.id,
      artworkId: payload.artworkId,
      soldPrice: payload.soldPrice,
      buyerName: payload.buyerName,
      buyerEmail: payload.buyerEmail,
      buyerPhone: payload.buyerPhone,
      deliveryAddress: payload.deliveryAddress,
      deliveryMode: payload.deliveryMode,
      soldAt: now,
      shipmentStatus: "preparing",
      dispatchedAt: null,
      deliveredAt: null,
      courierRef:
        payload.deliveryMode === "courier"
          ? `CR-${Date.now().toString(36).toUpperCase()}`
          : null,
    };
    aggregatorSalesCol.set([sale, ...aggregatorSalesCol.get()]);

    // Credit the wallet at the same 20%-of-markup rate dashboardSummary()
    // already uses (don't recompute a second formula) — see MOU §8's
    // "Profit Share = 20% × (Listed Price − Artist Price)"; this mock has no
    // artist_price field available here, so the markup base is
    // (displayPrice − artwork.customerPrice), same substitution
    // dashboardSummary() already documents and justifies.
    const artwork = getArtworkById(payload.artworkId);
    if (artwork) {
      const commission = Math.round(
        0.2 * Math.max(0, holding.displayPrice - artwork.customerPrice),
      );
      if (commission > 0) {
        const wallet = aggregatorWalletCol.get();
        aggregatorWalletCol.set({
          ...wallet,
          pendingBalance: wallet.pendingBalance + commission,
        });
        aggregatorWalletTransactionsCol.set([
          {
            id: `wt-${crypto.randomUUID().slice(0, 8)}`,
            type: "commission",
            label: `Commission: "${artwork.title}"`,
            amount: commission,
            date: now.slice(0, 10),
            status: "pending",
          },
          ...aggregatorWalletTransactionsCol.get(),
        ]);
      }
    }

    return mockDelay(updated);
  },

  // Synchronous, deliberately not a mockDelay-wrapped async mutation:
  // EditDisplayPriceDialog only needs to update local state (a single
  // number) and does so via queryClient.setQueryData for instant UI
  // feedback. This method exists purely so that update also lands in the
  // persisted store — without it, the next unrelated
  // ["aggregator-collection"] refetch would silently revert the edited price.
  updateDisplayPrice(
    holdingId: string,
    displayPrice: number,
  ): AggregatorHolding {
    const holdings = holdingsCol.get();
    const index = holdings.findIndex((h) => h.id === holdingId);
    if (index === -1) {
      throw new Error(`aggregatorService: no holding "${holdingId}"`);
    }
    const updated: AggregatorHolding = { ...holdings[index], displayPrice };
    holdingsCol.set(holdings.map((h, i) => (i === index ? updated : h)));
    return updated;
  },

  // KPI derivation. Advance payments are collected at reservation time, not
  // earned commission (that's realized on sale) — see the Onboarding
  // Guide's "20% of the 30% markup" worked example (₹30,000 listed →
  // ₹9,000 platform markup → ₹1,800 aggregator share). This mock layer
  // deliberately never carries the private artist_price field, so there's no
  // platform markup figure to take 20% of directly. The equivalent figure
  // available here is the aggregator's own markup over the customerPrice
  // floor (displayPrice - customerPrice) — commissionEarned is 20% of that,
  // summed only across holdings that have actually sold. A holding sold at
  // exactly the floor price (displayPrice === customerPrice, never raised)
  // contributes ₹0, which is the correct, honest result of this formula, not
  // a bug.
  dashboardSummary(): Promise<{
    activeReservations: number;
    commissionEarned: number;
    pendingSettlements: number;
  }> {
    const holdings = holdingsCol.get();
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
