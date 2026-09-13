import type { Order } from "@/types/order";
import { http, isApiError } from "@/lib/api";
import { toOrder, type OrderDto } from "@/lib/api-mappers";

// Real checkout against the API. Money is computed server-side from the
// artwork's pricing doc and the active rate config (packages/domain) — the
// order record the customer sees is exactly what the ledger was posted
// from, so the review-step preview (lib/pricing.ts) and the receipt agree
// by construction as long as the two engines share their constants.

export interface CreateOrderPayload {
  artworkId: string;
  addressId: string;
  /** Gateway result. Simulated for now; ignored by the API until Razorpay lands. */
  payment?: Order["payment"];
}

export const orderService = {
  list: async (): Promise<Order[]> => {
    const orders = await http.get<OrderDto[]>("/v1/orders");
    return orders.map(toOrder).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  get: async (id: string): Promise<Order | undefined> => {
    try {
      return toOrder(await http.get<OrderDto>(`/v1/orders/${encodeURIComponent(id)}`));
    } catch (error) {
      if (isApiError(error, 404)) return undefined;
      throw error;
    }
  },

  // Two calls: create (pending) then confirm. While Razorpay is deferred the
  // confirmation is the backend's simulated capture, which the order's own
  // customer may trigger (PAYMENTS_MODE=simulated). When the real gateway
  // lands, the second call becomes the gateway checkout + webhook and this
  // function's shape doesn't change.
  create: async (payload: CreateOrderPayload): Promise<Order> => {
    const { orderId } = await http.post<{ orderId: string; totalPaise: number }>("/v1/orders", {
      artworkId: payload.artworkId,
      addressId: payload.addressId,
      // One key per checkout attempt: a double-tap or retried request can't
      // create two orders (the API enforces uniqueness).
      idempotencyKey: crypto.randomUUID(),
    });
    await http.post(`/v1/orders/${encodeURIComponent(orderId)}/simulate-payment`);
    const order = await orderService.get(orderId);
    if (!order) throw new Error("Order was created but could not be read back");
    return order;
  },
};
