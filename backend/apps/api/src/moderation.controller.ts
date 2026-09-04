// Admin moderation endpoints — KYC, GST, insurance approve/reject.
// @galleryzone/db's decideGst/decideKyc/decideInsurance do the real work
// (same-transaction audit log write, state-machine-enforced) — verified
// directly in packages/db/moderation.check.ts against real Postgres.

import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { decideGst, decideKyc, decideInsurance, type Db } from "@galleryzone/db";
import { z } from "zod";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const decisionBodySchema = z.object({ reason: z.string().optional() }).strict();
type DecisionBody = z.infer<typeof decisionBodySchema>;

@Controller("v1/admin")
export class ModerationController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("admin")
  @Post("moderation/gst/:userId/approve")
  approveGst(@Param("userId") userId: string) {
    // TODO(Phase 1): adminId from the authenticated request.
    return decideGst({ db: this.db, adminId: "TODO-authenticated-user-id", userId, decision: "approved" });
  }

  @Roles("admin")
  @Post("moderation/gst/:userId/reject")
  rejectGst(@Param("userId") userId: string, @Body(new ZodValidationPipe(decisionBodySchema)) body: DecisionBody) {
    return decideGst({ db: this.db, adminId: "TODO-authenticated-user-id", userId, decision: "rejected", reason: body.reason });
  }

  @Roles("admin")
  @Post("moderation/kyc/:userId/approve")
  approveKyc(@Param("userId") userId: string) {
    return decideKyc({ db: this.db, adminId: "TODO-authenticated-user-id", userId, decision: "approved" });
  }

  @Roles("admin")
  @Post("moderation/kyc/:userId/reject")
  rejectKyc(@Param("userId") userId: string, @Body(new ZodValidationPipe(decisionBodySchema)) body: DecisionBody) {
    return decideKyc({ db: this.db, adminId: "TODO-authenticated-user-id", userId, decision: "rejected", reason: body.reason });
  }

  @Roles("admin")
  @Post("artworks/:artworkId/insurance/approve")
  approveInsurance(@Param("artworkId") artworkId: string) {
    return decideInsurance({ db: this.db, adminId: "TODO-authenticated-user-id", artworkId, decision: "approved" });
  }

  @Roles("admin")
  @Post("artworks/:artworkId/insurance/reject")
  rejectInsurance(@Param("artworkId") artworkId: string, @Body(new ZodValidationPipe(decisionBodySchema)) body: DecisionBody) {
    return decideInsurance({ db: this.db, adminId: "TODO-authenticated-user-id", artworkId, decision: "rejected", reason: body.reason });
  }
}
