// The aggregator (partner gallery) portal on the API. Offer terms come
// from the server (GET /v1/aggregator/inventory) so the card, the reserve
// page and the ledger all agree; holdings carry the public artwork.
// Money is paise on the wire and rupees here.

import type { AggregatorHolding, RecordSalePayload } from "@/types/aggregator";
import type { Artwork, ArtworkSummary } from "@/types/artwork";
import { http, isApiError } from "@/lib/api";
import { paiseToRupees, toArtwork, type ArtworkDto } from "@/lib/api-mappers";
import { toSummary } from "@/lib/artwork-summary";

export interface AggregatorOffer {
  artworkId: string;
  month: number;
  /** GalleryZone's price to the aggregator this month, before their uplift. */
  offerPrice: number;
  /** Month 1's price, before any monthly reduction — the ladder's top rung. */
  standardPrice: number;
  /** How much month `month`'s reduction has cut off standardPrice. 0 in month 1. */
  monthlyReduction: number;
  /** What the marketplace shows — unaffected by the cycle. */
  marketplacePrice: number;
  advance: number;
  advanceRate: number;
  advanceBase: number;
  advanceBasis: "display_price" | "artist_price";
  daysLeftInListing: number;
  deliveryCharge: number;
  /** Advance plus delivery — what the reservation costs. */
  payable: number;
  previousAggregatorChangedPrice: boolean;
}

export type ReservableArtwork = ArtworkSummary & { offer: AggregatorOffer };

interface OfferDto {
  artworkId: string;
  month: number;
  offerPricePaise: number;
  standardPricePaise: number;
  monthlyReductionPaise: number;
  marketplacePricePaise: number;
  advancePaise: number;
  advanceRate: number;
  advanceBasePaise: number;
  advanceBasis: "display_price" | "artist_price";
  daysLeftInListing: number;
  deliveryChargePaise: number;
  payablePaise: number;
  previousAggregatorChangedPrice: boolean;
}

interface HoldingDto {
  id: string;
  artworkId: string;
  artwork: ArtworkDto | null;
  cycleMonth: number;
  advancePercent: number;
  advancePaise: number;
  deliveryDepositPaise: number | null;
  displayPricePaise: number;
  assignmentSource: "self_reserved" | "gz_assigned";
  assignedAt: string;
  expiresAt: string;
  windowExtended: boolean;
  status: AggregatorHolding["status"];
  returnedAt: string | null;
}

function toOffer(o: OfferDto): AggregatorOffer {
  return {
    artworkId: o.artworkId,
    month: o.month,
    offerPrice: paiseToRupees(o.offerPricePaise),
    standardPrice: paiseToRupees(o.standardPricePaise),
    monthlyReduction: paiseToRupees(o.monthlyReductionPaise),
    marketplacePrice: paiseToRupees(o.marketplacePricePaise),
    advance: paiseToRupees(o.advancePaise),
    advanceRate: o.advanceRate,
    advanceBase: paiseToRupees(o.advanceBasePaise),
    advanceBasis: o.advanceBasis,
    daysLeftInListing: o.daysLeftInListing,
    deliveryCharge: paiseToRupees(o.deliveryChargePaise),
    payable: paiseToRupees(o.payablePaise),
    previousAggregatorChangedPrice: o.previousAggregatorChangedPrice,
  };
}

function toHolding(h: HoldingDto): AggregatorHolding {
  return {
    id: h.id,
    artworkId: h.artworkId,
    advancePercent: (h.advancePercent === 3 ? 3 : 5) as 5 | 3,
    advanceAmount: paiseToRupees(h.advancePaise),
    deliveryDeposit: h.deliveryDepositPaise === null ? undefined : paiseToRupees(h.deliveryDepositPaise),
    displayPrice: paiseToRupees(h.displayPricePaise),
    assignedAt: h.assignedAt,
    expiresAt: h.expiresAt,
    status: h.status,
    cycleMonth: h.cycleMonth,
    returnedAt: h.returnedAt,
    windowExtended: h.windowExtended,
    assignmentSource: h.assignmentSource,
  };
}

const withArtwork = (h: HoldingDto) => ({ ...toHolding(h), artwork: h.artwork ? toSummary(toArtwork(h.artwork)) : placeholderSummary(h.artworkId) });

function placeholderSummary(id: string): ArtworkSummary {
  return { id, title: "Artwork", artistId: "", artistName: "", verifiedArtist: false, category: "", medium: "", customerPrice: 0, thumbnailUrl: "/artworks/framed-painting.png", insured: false, status: "marketplace", listingType: "marketplace_and_aggregator" };
}

async function holdings(): Promise<HoldingDto[]> {
  const { holdings } = await http.get<{ holdings: HoldingDto[] }>("/v1/aggregator/holdings");
  return holdings;
}

export const aggregatorService = {
  async listReservableInventory(): Promise<ReservableArtwork[]> {
    const { artworks } = await http.get<{ artworks: (ArtworkDto & { offer: OfferDto })[] }>("/v1/aggregator/inventory");
    return artworks.map((a) => ({ ...toSummary(toArtwork(a)), offer: toOffer(a.offer) }));
  },

  async getReservableArtwork(artworkId: string): Promise<ReservableArtwork | null> {
    const all = await aggregatorService.listReservableInventory();
    return all.find((a) => a.id === artworkId) ?? null;
  },

  async reserve(artworkId: string): Promise<AggregatorHolding> {
    const h = await http.post<HoldingDto>("/v1/aggregator/holdings", { artworkId });
    return toHolding(h);
  },

  async releaseHolding(holdingId: string): Promise<{ refunded: number; deliveryLost: number }> {
    const h = await http.post<HoldingDto>(`/v1/aggregator/holdings/${encodeURIComponent(holdingId)}/return`);
    return { refunded: paiseToRupees(h.advancePaise), deliveryLost: h.deliveryDepositPaise ? paiseToRupees(h.deliveryDepositPaise) : 0 };
  },

  async setDisplayPrice(holdingId: string, displayPrice: number): Promise<AggregatorHolding> {
    const h = await http.post<HoldingDto>(`/v1/aggregator/holdings/${encodeURIComponent(holdingId)}/price`, { displayPricePaise: Math.round(displayPrice * 100) });
    return toHolding(h);
  },

  async listCollection(): Promise<Array<AggregatorHolding & { artwork: ArtworkSummary }>> {
    return (await holdings()).map(withArtwork);
  },

  async recordSale(payload: RecordSalePayload): Promise<AggregatorHolding> {
    const all = await holdings();
    const active = all.find((h) => h.artworkId === payload.artworkId && h.status === "reserved");
    if (!active) throw new Error("No active reservation found for this artwork");
    const address = [payload.deliveryAddress.line1, payload.deliveryAddress.city, payload.deliveryAddress.state, payload.deliveryAddress.pincode].filter(Boolean).join(", ");
    await http.post(`/v1/aggregator/holdings/${encodeURIComponent(active.id)}/sale`, {
      soldPricePaise: Math.round(payload.soldPrice * 100),
      buyerName: payload.buyerName,
      buyerEmail: payload.buyerEmail,
      ...(payload.buyerPhone ? { buyerPhone: payload.buyerPhone } : {}),
      deliveryMode: payload.deliveryMode,
      paymentRoute: payload.paymentRoute,
      ...(address ? { deliveryAddress: address } : {}),
    });
    const updated = await http.get<HoldingDto>(`/v1/aggregator/holdings/${encodeURIComponent(active.id)}`);
    return toHolding(updated);
  },

  async dashboardSummary(): Promise<{ activeReservations: number; commissionEarned: number; pendingSettlements: number; conversionRate: number | null }> {
    const all = await holdings();
    const active = all.filter((h) => h.status === "reserved").length;
    const sold = all.filter((h) => h.status === "sold_pending_settlement");
    const returned = all.filter((h) => h.status === "returned").length;
    const finished = sold.length + returned;
    return {
      activeReservations: active,
      // Commission is settled by GalleryZone after the sale; the wallet shows the credited amount.
      commissionEarned: 0,
      pendingSettlements: sold.length,
      conversionRate: finished ? Math.round((sold.length / finished) * 100) : null,
    };
  },

  async getHolding(holdingId: string): Promise<(AggregatorHolding & { artwork: Artwork }) | null> {
    try {
      const h = await http.get<HoldingDto>(`/v1/aggregator/holdings/${encodeURIComponent(holdingId)}`);
      if (!h.artwork) return null;
      return { ...toHolding(h), artwork: toArtwork(h.artwork) };
    } catch (error) {
      if (isApiError(error, 404)) return null;
      throw error;
    }
  },

  async debugSkipAheadDays(_holdingId: string, _days?: number): Promise<AggregatorHolding> {
    throw new Error("Placement windows run on the real clock");
  },
};
