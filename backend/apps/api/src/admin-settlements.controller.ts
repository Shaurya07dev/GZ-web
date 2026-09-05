import { Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { listSettlements, retrySettlement, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";

@Controller("v1/admin/settlements")
export class AdminSettlementsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("admin")
  @Get()
  list() {
    return listSettlements(this.db);
  }

  @Roles("admin")
  @Post(":id/retry")
  retry(@Param("id") id: string) {
    return retrySettlement(this.db, id);
  }
}
