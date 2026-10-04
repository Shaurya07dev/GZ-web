import type { Order } from "@/types/order";
import { http, isApiError } from "@/lib/api";
import { toOrder, type OrderDto } from "@/lib/api-mappers";
import { PaymentDismissedError, openCashfreeCheckout, type CashfreeSession } from "@/lib/cashfree-checkout";

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
  // 3a. Cashfree: run the payment flow, then ask the API to confirm. The API
  //     re-reads the order from Cashfree and marks it paid only if Cashfree
  //     itself says PAID for the right amount — nothing the browser reports is
  //     trusted (the webhook does the same independently, idempotently)
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
    const session = await http.post<{ mode: "simulated" } | CashfreeSession>(`${base}/payment/session`);
    if (session.mode === "cashfree") {
      const outcome = await openCashfreeCheckout(session);
      // Verified even when the SDK reported a problem: an errored modal can
      // still have taken the payment (a UPI app completing out of band), and
      // the API's answer comes from Cashfree rather than from this browser.
      // No body — there is nothing here worth sending.
      const confirmed = await http.post<{ status: string }>(`${base}/payment/verify`);
      if (confirmed.status !== "paid") {
        // Not paid, and the gateway said so. If the buyer simply closed the
        // window this is the quiet "nothing was charged" path; otherwise the
        // webhook will still settle it if a late capture arrives.
        if (outcome.reportedError || outcome.redirecting) throw new PaymentDismissedError();
        throw new Error("The payment did not go through. Nothing was charged.");
      }
    } else {
      await http.post(`${base}/simulate-payment`);
    }
    const order = await orderService.get(orderId);
    if (!order) throw new Error("Order was created but could not be read back");
    return order;
  },
};
