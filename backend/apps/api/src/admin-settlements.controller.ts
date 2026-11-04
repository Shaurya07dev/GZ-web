import { ConflictException, Controller, Get, Inject, NotFoundException, Param, Post } from "@nestjs/common";
import { IllegalTransitionError } from "@galleryzone/domain";
import { listSettlements, markSettlementProcessed, retrySettlement, SettlementError, type Db } from "@galleryzone/db";
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

  /**
   * Admin confirms a settlement has been paid out of band (bank transfer
   * or UPI from a different ledger). Used for artist royalty rows on
   * resale transfers; also useful for ops cleaning up stuck items.
   */
  @Roles("admin")
  @Post(":id/mark-paid")
  async markPaid(@Param("id") id: string) {
    try {
      await markSettlementProcessed(this.db, id);
      return { status: "processed" as const };
    } catch (error) {
      if (error instanceof SettlementError) throw new NotFoundException({ type: "about:blank", title: error.message, status: 404, code: "not_found" });
      if (error instanceof IllegalTransitionError) throw new ConflictException({ type: "about:blank", title: error.message, status: 409, code: "illegal_transition" });
      throw error;
    }
  }
}
