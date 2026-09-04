// The admin rules console's API surface — see the plan's "Admin rules
// console" section. Backed today by InMemoryRateConfigStore (Phase 0/1's
// only implementation); swapping in a Postgres-backed store later changes
// nothing here, since both implement the same RateConfigStore interface.
//
// SECURITY NOTE — not yet auth-gated. Every route here is the exact shape
// the finished platform_admin/finance_admin RBAC guard (plan's Security
// posture section) will wrap once Firebase auth exists (Phase 1). Running
// this locally/unauthenticated is fine for verifying the wiring; it must
// never be deployed reachable from the internet in this state — the plan
// explicitly rules out standing up a real, internet-facing endpoint before
// auth exists, and this module is not an exception to that.

import { Body, Controller, Get, Post, UsePipes } from "@nestjs/common";
import { loadActiveRates } from "@galleryzone/config";
import { InMemoryRateConfigStore } from "@galleryzone/db";
import { proposeRateChangeSchema, type ProposeRateChangeInput } from "@galleryzone/contracts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

@Controller("v1/admin/rate-config")
export class RateConfigController {
  // Module-scoped singleton for now — becomes a proper DI-provided
  // Postgres-backed store once packages/db has a real client (Phase 1).
  // Not resettable between requests, which is intentional: this is meant
  // to behave like the real durable store it stands in for.
  private readonly store = new InMemoryRateConfigStore();

  @Get()
  async getActive() {
    const rates = await loadActiveRates(this.store);
    return { rates };
  }

  @Post("propose")
  @UsePipes(new ZodValidationPipe(proposeRateChangeSchema))
  propose(@Body() body: ProposeRateChangeInput) {
    // TODO(Phase 1): proposedBy comes from the authenticated request's
    // user id once Firebase auth is wired in — never from the body.
    const versionId = this.store.propose({
      rates: body.rates,
      effectiveFrom: new Date(body.effectiveFrom),
      proposedBy: "TODO-authenticated-user-id",
      reason: body.reason,
    });
    return { versionId, status: "pending_approval" };
  }
}
