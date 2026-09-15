import type { Order } from "@/types/order";
import { http, isApiError } from "@/lib/api";
import { toOrder, type OrderDto } from "@/lib/api-mappers";
import { openRazorpayCheckout, type RazorpaySession } from "@/lib/razorpay-checkout";

// Real checkout against the API. Money is computed server-side from the
// artwork's pricing doc and the active rate config (packages/domain) — the
// order record the customer sees is exactly what the ledger was posted
// from, so the review-step preview (lib/pricing.ts) and the receipt agree
// by construction as long as the two engines share their constants.

export interface CreateOrderPayload {
  artworkId: string;
  addressId: string;
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

  // 1. create the order (pending)  2. ask the API for a payment session
  // 3a. Razorpay: open Checkout.js, then hand the signed result back to the
  //     API, which verifies the HMAC and marks the order paid (the webhook
  //     does the same independently, idempotently)
  // 3b. simulated (PAYMENTS_MODE=simulated on the API): the customer's own
  //     simulate-payment call — no money moves
  create: async (payload: CreateOrderPayload): Promise<Order> => {
    const { orderId } = await http.post<{ orderId: string; totalPaise: number }>("/v1/orders", {
      artworkId: payload.artworkId,
      addressId: payload.addressId,
      // One key per checkout attempt: a double-tap or retried request can't
      // create two orders (the API enforces uniqueness).
      idempotencyKey: crypto.randomUUID(),
    });
    const base = `/v1/orders/${encodeURIComponent(orderId)}`;
    const session = await http.post<{ mode: "simulated" } | RazorpaySession>(`${base}/payment/session`);
    if (session.mode === "razorpay") {
      const paid = await openRazorpayCheckout(session);
      await http.post(`${base}/payment/verify`, {
        razorpayOrderId: paid.razorpay_order_id,
        razorpayPaymentId: paid.razorpay_payment_id,
        signature: paid.razorpay_signature,
      });
    } else {
      await http.post(`${base}/simulate-payment`);
    }
    const order = await orderService.get(orderId);
    if (!order) throw new Error("Order was created but could not be read back");
    return order;
  },
};
