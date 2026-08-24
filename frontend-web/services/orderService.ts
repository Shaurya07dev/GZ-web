import type { Order } from "@/types/order";
import { mockDelay, mockError } from "@/lib/mock-utils";
import { getArtworkById } from "@/lib/mock-data/helpers";
import { artworksCol, ordersCol } from "@/lib/mock-collections";
import { checkoutTotal } from "@/lib/pricing";
import { creditArtistSettlement } from "./artistPayoutService";

// Every rupee figure lives in lib/pricing.ts. Nothing in this file invents a
// rate of its own — the checkout preview, the order record and the receipt all
// read the same checkoutTotal().


export interface CreateOrderPayload {
  artworkId: string;
  addressId: string;
  /** Gateway result, collected before the order is created. */
  payment?: Order["payment"];
}

// A marketplace sale credits the artist's PENDING balance. It becomes
// withdrawable 7 days after the piece is delivered — see
// services/artistPayoutService.ts, which owns that whole rule.
export const orderService = {
  list: (): Promise<Order[]> => mockDelay(ordersCol.get()),

  get: (id: string): Promise<Order | undefined> =>
    mockDelay(ordersCol.get().find((o) => o.id === id)),

  create: (payload: CreateOrderPayload): Promise<Order> => {
    const artwork = getArtworkById(payload.artworkId);
    if (!artwork) return mockError("Artwork not found");
    if (artwork.status !== "marketplace") {
      return mockError("This artwork is no longer available for purchase");
    }

    // GST is already inside customerPrice, so this is the portion of the price
    // that IS tax — not an extra charge on top of it.
    const totals = checkoutTotal(artwork.customerPrice);
    const now = new Date().toISOString();
    const order: Order = {
      id: `order-${crypto.randomUUID()}`,
      artworkId: payload.artworkId,
      addressId: payload.addressId,
      amount: artwork.customerPrice,
      gstAmount: totals.gstIncluded,
      deliveryCharge: totals.deliveryCharge,
      // A paid order, because payment is collected before this is called.
      status: payload.payment ? "paid" : "pending",
      createdAt: now,
      statusHistory: [
        { status: "pending", changedAt: now },
        ...(payload.payment
          ? [{ status: "paid" as const, changedAt: now }]
          : []),
      ],
      payment: payload.payment ?? null,
    };
    ordersCol.set([order, ...ordersCol.get()]);

    // Sold artworks come off the open marketplace — matches the pipeline's
    // Stage 9 ("Sale & Ownership Transfer"): a sold one-of-a-kind original
    // can't be bought twice.
    const artworks = artworksCol.get();
    artworksCol.set(
      artworks.map((a) =>
        a.id === artwork.id
          ? {
              ...a,
              status: "sold" as const,
              statusHistory: [
                ...a.statusHistory,
                { status: "sold" as const, changedAt: now },
              ],
            }
          : a,
      ),
    );

    // Marketplace channel: the artist is paid their asking price in full.
    creditArtistSettlement({
      artwork,
      orderId: order.id,
      channel: "marketplace",
    });

    return mockDelay(order);
  },
};
