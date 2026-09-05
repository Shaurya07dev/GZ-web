// The admin rules console's API surface — see the plan's "Admin rules
// console" section. Now backed by the real PostgresRateConfigStore (a
// module-scoped InMemoryRateConfigStore was the placeholder before a DB
// connection existed) — approve() is the two-step console's second half,
// which was missing until now.
//
// SECURITY: gated by RolesGuard (auth/roles.guard.ts), which fails closed
// with 501 for every @Roles() route until real Firebase-token auth exists.

import { Body, Controller, Get, Inject, Param, Post, UsePipes } from "@nestjs/common";
import { loadActiveRates } from "@galleryzone/config";
import { PostgresRateConfigStore, type Db } from "@galleryzone/db";
import { proposeRateChangeSchema, type ProposeRateChangeInput } from "@galleryzone/contracts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";

@Controller("v1/admin/rate-config")
export class RateConfigController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("admin", "platform_admin")
  @Get()
  async getActive() {
    const rates = await loadActiveRates(new PostgresRateConfigStore(this.db));
    return { rates };
  }

  @Roles("platform_admin")
  @Post("propose")
  @UsePipes(new ZodValidationPipe(proposeRateChangeSchema))
  async propose(@Body() body: ProposeRateChangeInput) {
    // TODO(Phase 1): proposedBy comes from the authenticated request's
    // user id once Firebase auth is wired in — never from the body.
    const versionId = await new PostgresRateConfigStore(this.db).propose({
      rates: body.rates,
      effectiveFrom: new Date(body.effectiveFrom),
      proposedBy: "TODO-authenticated-user-id",
      reason: body.reason,
    });
    return { versionId, status: "pending_approval" };
  }

  @Roles("platform_admin")
  @Post(":versionId/approve")
  async approve(@Param("versionId") versionId: string) {
    // TODO(Phase 1): approvedBy from the authenticated request — the store
    // itself refuses a self-approval when proposedBy === approvedBy.
    await new PostgresRateConfigStore(this.db).approve({ versionId, approvedBy: "TODO-authenticated-user-id" });
    return { versionId, status: "approved" };
  }
}
