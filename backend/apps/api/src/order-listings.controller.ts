import { Controller, Get, Inject, NotFoundException, Param, Req } from "@nestjs/common";
import { listCustomerOrders, getOrder, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";

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
    return order;
  }
}
