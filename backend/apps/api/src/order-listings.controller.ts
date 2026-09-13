import { Controller, Get, Inject, Param, Req } from "@nestjs/common";
import { listCustomerOrders, getOrder, listArtistArtworks, type Db } from "@galleryzone/db";
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
  get(@Param("id") id: string) {
    return getOrder(this.db, id);
  }

  @Roles("artist")
  @Get("artist/artworks")
  myArtworks(@Req() req: AuthenticatedRequest) {
    return listArtistArtworks(this.db, req.authUser.uid);
  }
}
