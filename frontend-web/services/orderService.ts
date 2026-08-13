import type { Order } from "@/types/order";
import { mockDelay, mockError } from "@/lib/mock-utils";
import { mockOrders } from "@/lib/mock-data/customer";
import { getArtworkById } from "@/lib/mock-data/helpers";

// GST rate and flat delivery charge are pinned here as the single source of
// truth — features/checkout/checkout-review-step.tsx mirrors this exact
// math for the pre-confirm price preview, so the two must stay in sync.
export const CHECKOUT_GST_RATE = 0.05;
export const CHECKOUT_DELIVERY_CHARGE = 250;

export interface CreateOrderPayload {
  artworkId: string;
  addressId: string;
}

export const orderService = {
  list: (): Promise<Order[]> => mockDelay(mockOrders),

  get: (id: string): Promise<Order | undefined> =>
    mockDelay(mockOrders.find((o) => o.id === id)),

  create: (payload: CreateOrderPayload): Promise<Order> => {
    const artwork = getArtworkById(payload.artworkId);
    if (!artwork) return mockError("Artwork not found");

    const gstAmount =
      Math.round(artwork.customerPrice * CHECKOUT_GST_RATE * 100) / 100;
    const now = new Date().toISOString();
    const order: Order = {
      id: `order-${crypto.randomUUID()}`,
      artworkId: payload.artworkId,
      addressId: payload.addressId,
      amount: artwork.customerPrice,
      gstAmount,
      deliveryCharge: CHECKOUT_DELIVERY_CHARGE,
      status: "pending",
      createdAt: now,
      statusHistory: [{ status: "pending", changedAt: now }],
    };
    return mockDelay(order);
  },
};
