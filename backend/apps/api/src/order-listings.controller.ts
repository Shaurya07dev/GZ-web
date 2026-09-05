import { Controller, Get, Inject, Param } from "@nestjs/common";
import { listCustomerOrders, getOrder, listArtistArtworks, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";

@Controller("v1")
export class OrderListingsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  // TODO(Phase 1): userId from the authenticated request, not a param.
  @Roles("customer")
  @Get("orders")
  listMine() {
    return listCustomerOrders(this.db, "TODO-authenticated-user-id");
  }

  @Roles("customer")
  @Get("orders/:id")
  get(@Param("id") id: string) {
    return getOrder(this.db, id);
  }

  @Roles("artist")
  @Get("artist/artworks")
  myArtworks() {
    return listArtistArtworks(this.db, "TODO-authenticated-user-id");
  }
}
