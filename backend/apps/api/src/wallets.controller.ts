import { Controller, Get, Inject, Req } from "@nestjs/common";
import { getWalletBalance, listWalletTransactions, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";

@Controller("v1/artist/wallet")
export class ArtistWalletController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("artist")
  @Get()
  async get(@Req() req: AuthenticatedRequest) {
    return getWalletBalance(this.db, "artist_payable", req.authUser.uid);
  }

  @Roles("artist")
  @Get("transactions")
  async transactions(@Req() req: AuthenticatedRequest) {
    return listWalletTransactions(this.db, "artist_payable", req.authUser.uid);
  }
}

@Controller("v1/aggregator/wallet")
export class AggregatorWalletController {
  constructor(@Inject(DB) private readonly db: Db) {}

  // Read-only per plan.md §3.4 — an aggregator is an agent, not a
  // principal, and never gets a real withdrawal endpoint; only this view.
  @Roles("aggregator")
  @Get()
  async get(@Req() req: AuthenticatedRequest) {
    return getWalletBalance(this.db, "aggregator_payable", req.authUser.uid);
  }
}

@Controller("v1/customer/wallet")
export class CustomerWalletController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("customer")
  @Get()
  async get(@Req() req: AuthenticatedRequest) {
    return getWalletBalance(this.db, "customer_wallet", req.authUser.uid);
  }
}
