import { Controller, Get, Inject, NotFoundException, Param, Req } from "@nestjs/common";
import { listCustomerOrders, getOrder, repricePendingOrder, type Db } from "@galleryzone/db";
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
}
