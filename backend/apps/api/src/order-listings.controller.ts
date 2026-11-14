import { Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { abandonPendingOrder, listCustomerOrders, getOrder, repricePendingOrder, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { resolveShippingQuote } from "./shipping-quote.ts";

@Controller("v1")
export class OrderListingsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("customer")
  @Get("orders")
  listMine(@Req() req: AuthenticatedRequest) {
    return listCustomerOrders(this.db, req.authUser.uid);
  }

  @Roles("customer")
  @Get("orders/:id")
  async get(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const order = await getOrder(this.db, id);
    // 404 rather than 403, like the payment routes: a stranger must not be
    // able to tell an order id apart from one that does not exist. The order
    // carries the buyer's addressId and what they paid, so this read has to
    // be scoped to its own customer.
    if (!order || order.customerId !== req.authUser.uid) {
      throw new NotFoundException({ type: "about:blank", title: "Not found", status: 404, code: "not_found" });
    }

    // Re-price pending orders on view so the detail page shows what the
    // buyer will ACTUALLY be charged when they click "Complete payment",
    // not a snapshot frozen the day the order was created. Client flag
    // 14 Nov 2026: an 8-Nov pending order showed ₹165.50 (old flat-₹25
    // delivery + old fee formula) in the detail page's price-breakdown
    // but /payment/session re-priced on resume and opened Razorpay at
    // the current amount — breadcrumb mismatch.
    //
    // repricePendingOrder is idempotent (same inputs → no write) and
    // trusts the order's stored shippingQuote when present. For old
    // orders with a null snapshot (pre-Shiprocket), we pass a fresh
    // quote so the displayed number reflects live reality.
    // NOTE: pending orders are no longer visible in the orders list (see
    // listCustomerOrders filter). But a direct link to the detail page still
    // works for the checkout retry UX — if the buyer somehow lands here with
    // a pending order, the re-price below ensures the number they see is
    // the number /payment/session will charge.
    if (order.status === "pending") {
      const fresh = order.shippingQuote
        ? { quote: undefined, reason: undefined }
        : await resolveShippingQuote(this.db, {
            artworkId: order.artworkId,
            addressId: order.addressId,
            customerId: req.authUser.uid,
          }).catch(() => ({ quote: undefined, reason: undefined }));
      await repricePendingOrder({
        db: this.db,
        orderId: id,
        ...(fresh.quote ? { deliveryQuote: fresh.quote } : {}),
      }).catch(() => undefined);
      // Re-read with the (possibly updated) numbers so the response
      // matches what /payment/session will charge.
      const refreshed = await getOrder(this.db, id);
      return refreshed ?? order;
    }
    return order;
  }

  /**
   * Called by the web + mobile clients when the buyer closes Razorpay
   * without paying. Cancels the pending order and drops the artwork back
   * into the buyer's cart, so the orders history stays a list of real
   * purchases rather than a graveyard of abandoned checkouts (client flag
   * 14 Nov 2026). Idempotent + silent on non-pending orders.
   */
  @Roles("customer")
  @HttpCode(204)
  @Post("orders/:id/abandon")
  async abandon(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    await abandonPendingOrder(this.db, id, req.authUser.uid);
  }
}
