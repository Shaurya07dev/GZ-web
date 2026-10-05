import type { Order } from "@/types/order";
import { http, isApiError } from "@/lib/api";
import { toOrder, type OrderDto } from "@/lib/api-mappers";
import { PaymentDismissedError, openRazorpayCheckout, type RazorpaySession } from "@/lib/razorpay-checkout";

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
  // 3a. Razorpay: run the payment flow, then ask the API to confirm. The API
  //     re-reads the order from Razorpay and marks it paid only if Razorpay
  //     itself says paid for the right amount — the signed payload we forward
  //     is checked too, but it is never sufficient on its own (the webhook
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
      const outcome = await openRazorpayCheckout(session);
      // Verified even when the modal was dismissed or reported a failure: it
      // can still have taken the payment (a UPI app completing out of band),
      // and the API's answer comes from Razorpay rather than from this browser.
      const confirmed = await http.post<{ status: string }>(`${base}/payment/verify`, outcome.success ?? undefined);
      if (confirmed.status !== "paid") {
        // Not paid, and the gateway said so. If the buyer simply closed the
        // window this is the quiet "nothing was charged" path; otherwise the
        // webhook will still settle it if a late capture arrives.
        if (outcome.dismissed) throw new PaymentDismissedError();
        throw new Error(outcome.failureMessage ?? "The payment did not go through. Nothing was charged.");
      }
    } else {
      await http.post(`${base}/simulate-payment`);
    }
    const order = await orderService.get(orderId);
    if (!order) throw new Error("Order was created but could not be read back");
    return order;
  },
};
