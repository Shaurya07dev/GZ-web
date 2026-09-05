import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { requestDeactivation, decideDeactivation, listExternalSaleFees, decideExternalSaleFee, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const requestSchema = z.object({ reason: z.string().min(1) }).strict();
type RequestBody = z.infer<typeof requestSchema>;
const decisionSchema = z.object({ note: z.string().optional() }).strict();
type DecisionBody = z.infer<typeof decisionSchema>;
const feeDecisionSchema = z.object({ decision: z.enum(["approved", "waived"]), note: z.string().optional() }).strict();
type FeeDecisionBody = z.infer<typeof feeDecisionSchema>;

@Controller("v1")
export class DeactivationController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("artist")
  @Post("artist/deactivation")
  request(@Body(new ZodValidationPipe(requestSchema)) body: RequestBody) {
    // TODO(Phase 1): userId from the authenticated request.
    return requestDeactivation(this.db, "TODO-authenticated-user-id", body.reason);
  }

  @Roles("admin")
  @Post("admin/deactivation/:userId/approve")
  approve(@Param("userId") userId: string, @Body(new ZodValidationPipe(decisionSchema)) body: DecisionBody) {
    return decideDeactivation(this.db, userId, "TODO-authenticated-user-id", "approved", body.note);
  }

  @Roles("admin")
  @Post("admin/deactivation/:userId/reject")
  reject(@Param("userId") userId: string, @Body(new ZodValidationPipe(decisionSchema)) body: DecisionBody) {
    return decideDeactivation(this.db, userId, "TODO-authenticated-user-id", "rejected", body.note);
  }

  @Roles("admin")
  @Get("admin/external-fees")
  listFees() {
    return listExternalSaleFees(this.db);
  }

  @Roles("admin")
  @Post("admin/external-fees/:id/decide")
  decideFee(@Param("id") id: string, @Body(new ZodValidationPipe(feeDecisionSchema)) body: FeeDecisionBody) {
    return decideExternalSaleFee(this.db, id, "TODO-authenticated-user-id", body.decision, body.note);
  }
}
