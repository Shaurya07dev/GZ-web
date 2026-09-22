// Admin moderation endpoints — KYC, GST, insurance approve/reject.
// @galleryzone/db's decideGst/decideKyc/decideInsurance do the real work
// (same-transaction audit log write, state-machine-enforced) — verified
// directly in packages/db/moderation.check.ts against real Postgres.

import { Body, Controller, Inject, Param, Post, Req } from "@nestjs/common";
import { decideGst, decideKyc, decideInsurance, type Db } from "@galleryzone/db";
import { z } from "zod";
import { Roles } from "./auth/roles.decorator.ts";
import { Emails } from "./mail/emails.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const decisionBodySchema = z.object({ reason: z.string().optional() }).strict();
type DecisionBody = z.infer<typeof decisionBodySchema>;

@Controller("v1/admin")
export class ModerationController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly emails: Emails,
  ) {}

  // Every decision below gates something the user cares about, so each one
  // mails the person it affects. Fire-and-forget: a mail failure must never
  // roll back a moderation decision that already committed.
  private mailCompliance(userId: string, kind: "gst" | "kyc", approved: boolean, reason?: string) {
    void this.emails.complianceDecided({ userId, kind, approved, reason }).catch(this.emails.swallow(`${kind} decision mail`));
  }

  @Roles("admin")
  @Post("moderation/gst/:userId/approve")
  async approveGst(@Req() req: AuthenticatedRequest, @Param("userId") userId: string) {
    const result = await decideGst({ db: this.db, adminId: req.authUser.uid, userId, decision: "approved" });
    this.mailCompliance(userId, "gst", true);
    return result;
  }

  @Roles("admin")
  @Post("moderation/gst/:userId/reject")
  async rejectGst(@Req() req: AuthenticatedRequest, @Param("userId") userId: string, @Body(new ZodValidationPipe(decisionBodySchema)) body: DecisionBody) {
    const result = await decideGst({ db: this.db, adminId: req.authUser.uid, userId, decision: "rejected", reason: body.reason });
    this.mailCompliance(userId, "gst", false, body.reason);
    return result;
  }

  @Roles("admin")
  @Post("moderation/kyc/:userId/approve")
  async approveKyc(@Req() req: AuthenticatedRequest, @Param("userId") userId: string) {
    const result = await decideKyc({ db: this.db, adminId: req.authUser.uid, userId, decision: "approved" });
    this.mailCompliance(userId, "kyc", true);
    return result;
  }

  @Roles("admin")
  @Post("moderation/kyc/:userId/reject")
  async rejectKyc(@Req() req: AuthenticatedRequest, @Param("userId") userId: string, @Body(new ZodValidationPipe(decisionBodySchema)) body: DecisionBody) {
    const result = await decideKyc({ db: this.db, adminId: req.authUser.uid, userId, decision: "rejected", reason: body.reason });
    this.mailCompliance(userId, "kyc", false, body.reason);
    return result;
  }

  @Roles("admin")
  @Post("artworks/:artworkId/insurance/approve")
  async approveInsurance(@Req() req: AuthenticatedRequest, @Param("artworkId") artworkId: string) {
    const result = await decideInsurance({ db: this.db, adminId: req.authUser.uid, artworkId, decision: "approved" });
    void this.emails.insuranceDecided({ artworkId, approved: true }).catch(this.emails.swallow("insurance decision mail"));
    return result;
  }

  @Roles("admin")
  @Post("artworks/:artworkId/insurance/reject")
  async rejectInsurance(@Req() req: AuthenticatedRequest, @Param("artworkId") artworkId: string, @Body(new ZodValidationPipe(decisionBodySchema)) body: DecisionBody) {
    const result = await decideInsurance({ db: this.db, adminId: req.authUser.uid, artworkId, decision: "rejected", reason: body.reason });
    void this.emails.insuranceDecided({ artworkId, approved: false, reason: body.reason }).catch(this.emails.swallow("insurance decision mail"));
    return result;
  }
}
