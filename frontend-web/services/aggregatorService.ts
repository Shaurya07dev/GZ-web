import type {
  AggregatorHolding,
  AggregatorSale,
  RecordSalePayload,
} from "@/types/aggregator";
import { isAggregatorListed, type ArtworkSummary } from "@/types/artwork";
import { getArtworkById, toSummary } from "@/lib/mock-data/helpers";
import {
  DELIVERY_CHARGE,
  aggregatorAdvanceOf,
  aggregatorCommissionOf,
} from "@/lib/pricing";
import {
  artistPriceOf,
  creditArtistSettlement,
} from "./artistPayoutService";
import { mockDelay, mockError } from "@/lib/mock-utils";
import { buyerInviteService } from "./buyerInviteService";
import {
  artworksCol,
  holdingsCol,
  aggregatorSalesCol,
  aggregatorWalletCol,
  aggregatorWalletTransactionsCol,
  aggregatorProfileCol,
} from "@/lib/mock-collections";

// ---------------------------------------------------------------------------
// Business rules (chosen and documented once here, applied consistently
// everywhere this service is the source of truth: dashboard KPI math, the
// inventory reserve flow, and the collection display).
// ---------------------------------------------------------------------------

// Aggregator MOU §7, confirmed by the money-flow sheets: the advance is a flat
// 5% of the price the piece is being displayed at, paid with the delivery
// charge before the aggregator takes possession. The older "5% under ₹25,000,
// 3% above" split was this mock's own invention, made before the sheets
// existed. Seeded fixture holdings still carry 3%, which is why the type keeps
// the union.
//
// Exported (not just used internally by reserve() below) so
// ReserveArtworkDialog can preview the exact advance a confirm click will
// produce, without duplicating the rule or waiting on a round trip.
export function advancePercentFor(): 5 {
  return 5;
}

export function advanceAmountFor(displayPrice: number): number {
  return aggregatorAdvanceOf(displayPrice);
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
          isAggregatorListed(artwork.listingType) &&
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

    // MOU first, inventory second: an unsigned aggregator has no agreement
    // covering custody, pricing or settlement, so they cannot take possession
    // of anyone's artwork. Enforced here rather than only in the UI.
    if (!aggregatorProfileCol.get().mouAcceptance) {
      return mockError(
        "Sign your Aggregator MOU in My Profile before reserving artwork",
      );
    }

    const artwork = getArtworkById(artworkId);
    const holdings = holdingsCol.get();
    const alreadyClaimed = holdings.some((h) => h.artworkId === artworkId);
    if (!artwork || alreadyClaimed) {
      return mockError("Artwork no longer available");
    }

    const advancePercent = advancePercentFor();
    const assignedAt = new Date();
    const expiresAt = new Date(assignedAt.getTime() + THIRTY_DAYS_MS);

    const holding: AggregatorHolding = {
      id: nextHoldingId(holdings),
      artworkId,
      advancePercent,
      advanceAmount: advanceAmountFor(artwork.customerPrice),
      // Paid up front alongside the advance (MOU §7). Refunded on a sale;
      // forfeited if the piece goes back unsold.
      deliveryDeposit: DELIVERY_CHARGE,
      displayPrice: artwork.customerPrice, // floor, per SAD §2.7 — see edit-display-price-dialog.tsx for the raise-only enforcement
      assignedAt: assignedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: "reserved",
      assignmentSource: "self_reserved",
      displayPriceSetAt: null,
    };
    holdingsCol.set([...holdings, holding]);
    return mockDelay(holding);
  },

  // The piece did not sell and goes back to GalleryZone. The money-flow sheet
  // is explicit that only the advance comes back in this case — the delivery
  // charge is settled only on a sale, so an unsold return costs the aggregator
  // that leg. Frees the artwork to be reserved again.
  releaseHolding(holdingId: string): Promise<{ refunded: number }> {
    const holdings = holdingsCol.get();
    const holding = holdings.find((h) => h.id === holdingId);
    if (!holding) return mockError("Reservation not found");
    if (holding.status !== "reserved") {
      return mockError("This piece has already sold and cannot be returned");
    }

    const artwork = getArtworkById(holding.artworkId);
    const refunded = holding.advanceAmount;
    const now = new Date().toISOString();

    if (refunded > 0) {
      const wallet = aggregatorWalletCol.get();
      aggregatorWalletCol.set({
        ...wallet,
        pendingBalance: wallet.pendingBalance + refunded,
      });
      aggregatorWalletTransactionsCol.set([
        {
          id: `wt-${crypto.randomUUID().slice(0, 8)}`,
          type: "refund",
          label: `Advance returned: "${artwork?.title ?? "Artwork"}"`,
          amount: refunded,
          date: now.slice(0, 10),
          status: "pending",
        },
        ...aggregatorWalletTransactionsCol.get(),
      ]);
    }

    holdingsCol.set(holdings.filter((h) => h.id !== holdingId));
    return mockDelay({ refunded });
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

    // The buyer walked in off the street and has no account. Hold their
    // purchase against their email so it appears in their collection the
    // moment they register (services/buyerInviteService.ts).
    const soldArtwork = getArtworkById(payload.artworkId);
    buyerInviteService.create({
      email: payload.buyerEmail,
      name: payload.buyerName,
      artworkId: payload.artworkId,
      artworkTitle: soldArtwork?.title ?? "Artwork",
      soldPrice: payload.soldPrice,
      soldAt: now,
      source: "aggregator_sale",
    });

    // MOU §8: 20% x (selling price - ARTIST price). The old code compared
    // against artwork.customerPrice — GalleryZone's price to the aggregator —
    // which on the client's own worked example pays 4,000 instead of 10,000.
    // The artist price is recoverable (artistPriceOf), so the substitution is
    // no longer needed.
    const artwork = getArtworkById(payload.artworkId);
    if (artwork) {
      const artistPrice = artistPriceOf(artwork);
      const commission = aggregatorCommissionOf(holding.displayPrice, artistPrice);
      // A sale returns the advance and the delivery deposit as well as paying
      // commission — see the settlement block on the money-flow sheet:
      // 7,500 advance + 2,500 delivery + 10,000 commission = 20,000.
      const refund = holding.advanceAmount + (holding.deliveryDeposit ?? 0);
      const credited = commission + refund;

      if (credited > 0) {
        const wallet = aggregatorWalletCol.get();
        aggregatorWalletCol.set({
          ...wallet,
          pendingBalance: wallet.pendingBalance + credited,
        });
        const rows = [
          commission > 0 && {
            id: `wt-${crypto.randomUUID().slice(0, 8)}`,
            type: "commission" as const,
            label: `Commission: "${artwork.title}"`,
            amount: commission,
            date: now.slice(0, 10),
            status: "pending" as const,
          },
          refund > 0 && {
            id: `wt-${crypto.randomUUID().slice(0, 8)}`,
            type: "refund" as const,
            label: `Advance & delivery returned: "${artwork.title}"`,
            amount: refund,
            date: now.slice(0, 10),
            status: "pending" as const,
          },
        ].filter((row) => row !== false);
        aggregatorWalletTransactionsCol.set([
          ...rows,
          ...aggregatorWalletTransactionsCol.get(),
        ]);
      }

      // The artist's side of the same sale: their price less the delivery leg
      // and 2% convenience (1,00,000 -> 95,500 on the sheet).
      creditArtistSettlement({
        artwork,
        orderId: sale.id,
        channel: "aggregator",
      });
    }

    return mockDelay(updated);
  },

  // Synchronous, deliberately not a mockDelay-wrapped async mutation:
  // EditDisplayPriceDialog only needs to update local state (a single
  // number) and does so via queryClient.setQueryData for instant UI
  // feedback. This method exists purely so that update also lands in the
  // persisted store — without it, the next unrelated
  // ["aggregator-collection"] refetch would silently revert the edited price.
  // One opportunity only (MOU §6). Enforced here, not just by hiding the
  // button, so a stale tab can't post a second price.
  updateDisplayPrice(
    holdingId: string,
    displayPrice: number,
  ): AggregatorHolding {
    const holdings = holdingsCol.get();
    const index = holdings.findIndex((h) => h.id === holdingId);
    if (index === -1) {
      throw new Error(`aggregatorService: no holding "${holdingId}"`);
    }
    if (holdings[index].displayPriceSetAt) {
      throw new Error(
        "The selling price for this artwork has already been set and cannot be changed (MOU §6)",
      );
    }
    const updated: AggregatorHolding = {
      ...holdings[index],
      displayPrice,
      displayPriceSetAt: new Date().toISOString(),
    };
    holdingsCol.set(holdings.map((h, i) => (i === index ? updated : h)));
    return updated;
  },

  // KPI derivation. Advance payments are collected at reservation time and are
  // not earnings — commission is realized on sale, at MOU §8's rate of 20% x
  // (selling price - artist price), the same aggregatorCommissionOf() used
  // when the sale is actually recorded.
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
      return sum + aggregatorCommissionOf(holding.displayPrice, artistPriceOf(artwork));
    }, 0);

    return mockDelay({
      activeReservations,
      commissionEarned: Math.round(commissionEarned),
      pendingSettlements,
    });
  },
};
