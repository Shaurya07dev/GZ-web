import type {
  AggregatorHolding,
  AggregatorSale,
  RecordSalePayload,
} from "@/types/aggregator";
import { isAggregatorListed, type ArtworkSummary } from "@/types/artwork";
import { getArtworkById, toSummary } from "@/lib/mock-data/helpers";
import {
  AGGREGATOR_LISTING_DAYS,
  aggregatorAdvanceForMonth,
  aggregatorAdvanceOf,
  aggregatorCommissionOf,
  aggregatorOfferPriceOf,
  canPlaceWithAnotherAggregator,
  daysLeftInListing,
  placementWindow,
  withGst,
} from "@/lib/pricing";
import { artistPriceOf, creditArtistSettlement } from "./artistPayoutService";
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

// Holdings are backed by lib/mock-db.ts via holdingsCol (lib/mock-collections.ts)
// so reserve()/recordSale() survive a refresh and are
// visible across tabs/portals — an artwork reserved via Inventory actually
// disappears from inventory and shows up in Collection, for good. This
// intentionally does NOT mutate the shared `artworksCol` records — that
// collection is shared with the Marketplace/Admin tracks, and mutating it in
// place would leak side effects into pages this track doesn't own.
// Consequence: an artwork's own `status` field stays "marketplace" even
// after this service reserves it — every check in this file and in the
// Aggregator Portal's pages treats `holdings` (not artwork.status) as the
// real source of truth for what's reserved/sold.
function formatHeld(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

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

// --- The five-month cycle ---------------------------------------------------
//
// A piece that doesn't sell is offered to a different aggregator each month,
// five times, each at a lower price and a different advance rate (see
// lib/pricing.ts). The month is a property of the ARTWORK's journey, not of any
// one aggregator, so it is counted from how many aggregators have already had
// it — which is why returned holdings are kept rather than deleted.

/** Placements this artwork has already been through, in order. */
function pastHoldingsFor(artworkId: string): AggregatorHolding[] {
  return holdingsCol
    .get()
    .filter((h) => h.artworkId === artworkId && h.status === "returned")
    .sort((a, b) => a.assignedAt.localeCompare(b.assignedAt));
}

/** Which month of the cycle the NEXT placement of this artwork would be. */
function cycleMonthFor(artworkId: string): number {
  return pastHoldingsFor(artworkId).length + 1;
}

/**
 * When this artwork's 180-day listing started — the first time any aggregator
 * took it. Null means it has never been placed, so the clock has not started.
 */
function cycleStartFor(artworkId: string): string | null {
  const all = holdingsCol
    .get()
    .filter((h) => h.artworkId === artworkId)
    .sort((a, b) => a.assignedAt.localeCompare(b.assignedAt));
  return all[0]?.assignedAt ?? null;
}

/** Can this piece go to another aggregator, or is its listing done? */
function isPlaceable(artworkId: string, now: number = Date.now()): boolean {
  return canPlaceWithAnotherAggregator({
    cycleStartedAt: cycleStartFor(artworkId),
    placementsSoFar: pastHoldingsFor(artworkId).length,
    now,
  });
}

/** A reservable artwork, with this month's terms attached. */
export type ReservableArtwork = ArtworkSummary & { offer: AggregatorOffer };

export interface AggregatorOffer {
  artworkId: string;
  month: number;
  /** GalleryZone's price to the aggregator this month, before their uplift. */
  offerPrice: number;
  /** What the marketplace shows — unaffected by the cycle. */
  marketplacePrice: number;
  advance: number;
  advanceRate: number;
  /** The figure the rate was applied to, so the UI can show the working. */
  advanceBase: number;
  advanceBasis: "display_price" | "artist_price";
  /** Days left on the artwork's 180-day listing. */
  daysLeftInListing: number;
  deliveryCharge: number;
  /** Advance plus delivery — the amount locked from the wallet on reserve. */
  payable: number;
  /** Whether the previous aggregator used their one price change. */
  previousAggregatorChangedPrice: boolean;
}

function buildOffer(artwork: {
  id: string;
  customerPrice: number;
}): AggregatorOffer {
  const month = cycleMonthFor(artwork.id);
  const artistPrice = artistPriceOf(artwork);
  // GST-inclusive, exactly like Artwork.customerPrice — the aggregator's floor
  // and the customer's price have to be the same kind of number, or the
  // commission (which strips GST back out) is computed against the wrong base.
  const offerPrice = withGst(aggregatorOfferPriceOf(artistPrice, month));
  const past = pastHoldingsFor(artwork.id);
  const cycleStartedAt = cycleStartFor(artwork.id);
  const previousAggregatorChangedPrice = Boolean(
    past[past.length - 1]?.displayPriceSetAt,
  );

  const advance = aggregatorAdvanceForMonth({
    month,
    // Month 1 is charged on the display price, which is GalleryZone's offer
    // price — the aggregator cannot move it.
    displayPrice: offerPrice,
    artistPrice,
    previousAggregatorChangedPrice,
  });

  return {
    artworkId: artwork.id,
    month,
    offerPrice,
    marketplacePrice: artwork.customerPrice,
    advance: advance.advance,
    advanceRate: advance.rate,
    advanceBase: advance.base,
    advanceBasis: advance.basis,
    deliveryCharge: advance.deliveryCharge,
    payable: advance.payable,
    previousAggregatorChangedPrice,
    daysLeftInListing: cycleStartedAt
      ? daysLeftInListing(cycleStartedAt)
      : AGGREGATOR_LISTING_DAYS,
  };
}

export const aggregatorService = {
  // Reservable = eligible for aggregator display, still on the open
  // marketplace, and not already claimed by any holding (reserved or
  // already sold_pending_settlement) — checked against the live `holdings`
  // store, not a frozen fixture, so a just-reserved artwork can never be
  // reserved twice.
  listReservableInventory(): Promise<ReservableArtwork[]> {
    // A returned holding no longer claims its artwork — that is the whole
    // point of the cycle: the piece goes back and the next aggregator can
    // take it, at the next month's price.
    const claimedArtworkIds = new Set(
      holdingsCol
        .get()
        .filter((h) => h.status !== "returned")
        .map((h) => h.artworkId),
    );
    const reservable = artworksCol.get().filter(
      (artwork) =>
        isAggregatorListed(artwork.listingType) &&
        artwork.status === "marketplace" &&
        !claimedArtworkIds.has(artwork.id) &&
        // Five placements, or fewer if the 180 days run out first. A stub of
        // under thirty days is never placed with a new aggregator — it goes
        // to whoever already has the piece.
        isPlaceable(artwork.id),
    );
    // Each card carries its own offer so the grid and the reserve dialog read
    // the cycle rules from one place instead of each re-deriving them.
    return mockDelay(
      reservable.map((artwork) => ({
        ...toSummary(artwork),
        offer: buildOffer(artwork),
      })),
    );
  },

  reserve(artworkId: string): Promise<AggregatorHolding> {
    // MOU first, inventory second: an unsigned aggregator has no agreement
    // covering custody, pricing or settlement, so they cannot take possession
    // of anyone's artwork. Enforced here rather than only in the UI.
    if (!aggregatorProfileCol.get().mouAcceptance) {
      return mockError(
        "Sign your Aggregator MOU in My Profile before reserving artwork",
      );
    }

    // Three different failures used to share one "Artwork no longer
    // available", which made a report of it impossible to act on: nobody
    // could tell whether the piece had gone, someone else had taken it, or
    // the grid was showing something the store no longer had. Each says what
    // actually happened now.
    const artwork = getArtworkById(artworkId);
    if (!artwork) {
      return mockError(
        "That piece is no longer listed. Refresh to see what is available.",
      );
    }

    const holdings = holdingsCol.get();
    const claim = holdings.find(
      (h) => h.artworkId === artworkId && h.status !== "returned",
    );
    if (claim) {
      return mockError(
        claim.status === "sold_pending_settlement"
          ? "This piece has already been sold."
          : "Another aggregator reserved this piece first.",
      );
    }

    const offer = buildOffer(artwork);
    if (!isPlaceable(artworkId)) {
      return mockError(
        "This piece has finished its listing period and is going back to the artist",
      );
    }

    // The advance is not a fresh payment every time — it is LOCKED from the
    // aggregator's wallet. Deposit once, and each reservation holds what it
    // needs; only a shortfall has to be topped up. Enforced here so a stale tab
    // cannot reserve past the balance.
    const wallet = aggregatorWalletCol.get();
    const free = wallet.balance - wallet.lockedBalance;
    if (free < offer.payable) {
      const shortfall = offer.payable - free;
      return mockError(
        `Add ₹${shortfall.toLocaleString("en-IN")} to your wallet to reserve this piece — ₹${offer.payable.toLocaleString("en-IN")} needs to be held and only ₹${Math.max(0, free).toLocaleString("en-IN")} is free.`,
      );
    }

    const assignedAt = new Date();
    // Thirty days, unless what would be left over afterwards is too short to
    // place with anyone else — then this aggregator keeps it to the end of the
    // artist's 180 days rather than the piece making one more pointless trip.
    const { expiresAt, extended } = placementWindow({
      cycleStartedAt: cycleStartFor(artworkId) ?? assignedAt,
      assignedAt,
    });

    const holding: AggregatorHolding = {
      id: nextHoldingId(holdings),
      artworkId,
      advancePercent: offer.advanceRate === 0.05 ? 5 : 3,
      advanceAmount: offer.advance,
      // Held alongside the advance (MOU §7). Returned on a sale; forfeited if
      // the piece goes back unsold.
      deliveryDeposit: offer.deliveryCharge,
      cycleMonth: offer.month,
      // GalleryZone's calculated figure for this month, and the price the
      // piece sells at. The aggregator displays it; they do not price it.
      displayPrice: offer.offerPrice,
      assignedAt: assignedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      windowExtended: extended,
      status: "reserved",
      assignmentSource: "self_reserved",
      displayPriceSetAt: null,
      returnedAt: null,
    };

    aggregatorWalletCol.set({
      ...wallet,
      lockedBalance: wallet.lockedBalance + offer.payable,
    });
    aggregatorWalletTransactionsCol.set([
      {
        id: `wt-${crypto.randomUUID().slice(0, 8)}`,
        type: "adjustment",
        label: `Held for "${artwork.title}" — month ${offer.month} advance & delivery`,
        amount: -offer.payable,
        date: assignedAt.toISOString().slice(0, 10),
        status: "pending",
      },
      ...aggregatorWalletTransactionsCol.get(),
    ]);

    holdingsCol.set([...holdings, holding]);
    return mockDelay(holding);
  },

  // The piece did not sell and goes back to GalleryZone. The money-flow sheet
  // is explicit that only the advance comes back in this case — the delivery
  // charge is settled only on a sale, so an unsold return costs the aggregator
  // that leg. Frees the artwork to be reserved again.
  releaseHolding(
    holdingId: string,
  ): Promise<{ refunded: number; deliveryLost: number }> {
    const holdings = holdingsCol.get();
    const holding = holdings.find((h) => h.id === holdingId);
    if (!holding) return mockError("Reservation not found");
    if (holding.status !== "reserved") {
      return mockError("This piece has already sold and cannot be returned");
    }

    const artwork = getArtworkById(holding.artworkId);
    const deliveryLost = holding.deliveryDeposit ?? 0;
    const held = holding.advanceAmount + deliveryLost;
    const now = new Date().toISOString();

    // The advance and delivery were locked from the aggregator's own wallet,
    // never taken from it, so nothing is "credited back" here — the hold is
    // released. The delivery portion is the exception: the sheet settles it
    // only on a sale, so an unsold return actually spends it.
    const wallet = aggregatorWalletCol.get();
    aggregatorWalletCol.set({
      ...wallet,
      lockedBalance: Math.max(0, wallet.lockedBalance - held),
      balance: wallet.balance - deliveryLost,
    });

    const rows = [
      {
        id: `wt-${crypto.randomUUID().slice(0, 8)}`,
        type: "refund" as const,
        label: `Advance released: "${artwork?.title ?? "Artwork"}"`,
        amount: holding.advanceAmount,
        date: now.slice(0, 10),
        status: "completed" as const,
      },
      ...(deliveryLost > 0
        ? [
            {
              id: `wt-${crypto.randomUUID().slice(0, 8)}`,
              type: "adjustment" as const,
              label: `Delivery charged — "${artwork?.title ?? "Artwork"}" returned unsold`,
              amount: -deliveryLost,
              date: now.slice(0, 10),
              status: "completed" as const,
            },
          ]
        : []),
    ];
    aggregatorWalletTransactionsCol.set([
      ...rows,
      ...aggregatorWalletTransactionsCol.get(),
    ]);

    // Kept, not deleted: the next aggregator's price and advance are counted
    // off how many placements this artwork has already been through.
    holdingsCol.set(
      holdings.map((h) =>
        h.id === holdingId
          ? { ...h, status: "returned" as const, returnedAt: now }
          : h,
      ),
    );
    return mockDelay({ refunded: holding.advanceAmount, deliveryLost });
  },

  listCollection(): Promise<
    Array<AggregatorHolding & { artwork: ArtworkSummary }>
  > {
    // Returned pieces are history for the cycle counter, not part of anyone's
    // current collection.
    return mockDelay(
      holdingsCol
        .get()
        .filter((h) => h.status !== "returned")
        .map(withArtwork),
    );
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
      paymentRoute: payload.paymentRoute,
      // Cash taken at the counter is GalleryZone's money sitting in the
      // aggregator's till until they transfer it.
      remittedAt: null,
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
      const commission = aggregatorCommissionOf(
        holding.displayPrice,
        artistPrice,
      );
      // A sale settles all three lines on the sheet — 7,500 advance + 2,500
      // delivery + 10,000 commission = 20,000. But the first two were LOCKED
      // from this aggregator's own wallet rather than taken from it, so they
      // are released, not credited. Only the commission is new money.
      const held = holding.advanceAmount + (holding.deliveryDeposit ?? 0);

      const wallet = aggregatorWalletCol.get();
      aggregatorWalletCol.set({
        ...wallet,
        lockedBalance: Math.max(0, wallet.lockedBalance - held),
        pendingBalance: wallet.pendingBalance + commission,
      });

      // The client's answer on the advance was "both" — it always comes back
      // AND it is adjusted against what is owed. Both are true at once if it is
      // settled as one statement rather than two movements: the advance is set
      // off against the sale, and the aggregator ends up whole either way.
      const rows = [
        ...(held > 0
          ? [
              {
                id: `wt-${crypto.randomUUID().slice(0, 8)}`,
                type: "refund" as const,
                label: `"${artwork.title}" sold — ${formatHeld(held)} advance & delivery set off against settlement`,
                amount: held,
                date: now.slice(0, 10),
                status: "completed" as const,
              },
            ]
          : []),
        ...(commission > 0
          ? [
              {
                id: `wt-${crypto.randomUUID().slice(0, 8)}`,
                type: "commission" as const,
                label: `Commission: "${artwork.title}"`,
                amount: commission,
                date: now.slice(0, 10),
                status: "pending" as const,
              },
            ]
          : []),
      ];
      if (rows.length > 0) {
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

  // KPI derivation. Advance payments are collected at reservation time and are
  // not earnings — commission is realized on sale, at MOU §8's rate of 20% x
  // (selling price - artist price), the same aggregatorCommissionOf() used
  // when the sale is actually recorded.
  dashboardSummary(): Promise<{
    activeReservations: number;
    commissionEarned: number;
    pendingSettlements: number;
    conversionRate: number | null;
  }> {
    const holdings = holdingsCol.get();
    const activeReservations = holdings.filter(
      (h) => h.status === "reserved",
    ).length;
    const soldHoldings = holdings.filter(
      (h) => h.status === "sold_pending_settlement",
    );
    const returnedHoldings = holdings.filter((h) => h.status === "returned");
    const pendingSettlements = soldHoldings.length;
    const commissionEarned = soldHoldings.reduce((sum, holding) => {
      const artwork = getArtworkById(holding.artworkId);
      if (!artwork) return sum;
      return (
        sum +
        aggregatorCommissionOf(holding.displayPrice, artistPriceOf(artwork))
      );
    }, 0);

    // Conversion is measured over concluded reservations only (sold or
    // returned) -- a still-active reservation hasn't gone either way yet, so
    // counting it would understate the rate for no reason.
    const concludedCount = soldHoldings.length + returnedHoldings.length;
    const conversionRate =
      concludedCount === 0
        ? null
        : Math.round((soldHoldings.length / concludedCount) * 100);

    return mockDelay({
      activeReservations,
      commissionEarned: Math.round(commissionEarned),
      pendingSettlements,
      conversionRate,
    });
  },
};
