// The admin rules console's API surface — see the plan's "Admin rules
// console" section. Backed by the real FirestoreRateConfigStore.
//
// SECURITY: gated by RolesGuard (auth/roles.guard.ts) — a real Firebase
// ID token is now verified and the caller's role re-derived from
// Firestore on every request, not the 501 stub from before.

import { Body, Controller, Get, Inject, Param, Post, Req, UsePipes } from "@nestjs/common";
import { loadActiveRates } from "@galleryzone/config";
import { FirestoreRateConfigStore, reindexAllListings, type Db } from "@galleryzone/db";
import { proposeRateChangeSchema, type ProposeRateChangeInput } from "@galleryzone/contracts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ReadCache } from "./read-cache.ts";


@Controller("v1/admin/rate-config")
export class RateConfigController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cache: ReadCache,
  ) {}

  @Roles("admin", "platform_admin")
  @Get()
  async getActive() {
    const rates = await loadActiveRates(new FirestoreRateConfigStore(this.db));
    return { rates };
  }

  @Roles("platform_admin")
  @Post("propose")
  @UsePipes(new ZodValidationPipe(proposeRateChangeSchema))
  async propose(@Req() req: AuthenticatedRequest, @Body() body: ProposeRateChangeInput) {
    const versionId = await new FirestoreRateConfigStore(this.db).propose({
      rates: body.rates,
      effectiveFrom: new Date(body.effectiveFrom),
      proposedBy: req.authUser.uid,
      reason: body.reason,
    });
    return { versionId, status: "pending_approval" };
  }

  @Roles("platform_admin")
  @Post(":versionId/approve")
  async approve(@Req() req: AuthenticatedRequest, @Param("versionId") versionId: string) {
    // The store itself refuses a self-approval when proposedBy === approvedBy.
    await new FirestoreRateConfigStore(this.db).approve({ versionId, approvedBy: req.authUser.uid });
    // Every display price just moved: rebuild the projections, then drop the caches.
    await reindexAllListings(this.db);
    this.cache.clear();
    return { versionId, status: "approved" };
  }
}
