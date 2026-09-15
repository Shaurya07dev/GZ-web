import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { requestDeactivation, decideDeactivation, listExternalSaleFees, decideExternalSaleFee, type Db, getDeactivationRequest, listDeactivationRequests } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
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
  @Get("artist/deactivation")
  async mine(@Req() req: AuthenticatedRequest) {
    return { request: await getDeactivationRequest(this.db, req.authUser.uid) };
  }

  @Roles("admin")
  @Get("admin/deactivation")
  async queue() {
    return { requests: await listDeactivationRequests(this.db) };
  }

  @Roles("artist")
  @Post("artist/deactivation")
  request(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(requestSchema)) body: RequestBody) {
    return requestDeactivation(this.db, req.authUser.uid, body.reason);
  }

  @Roles("admin")
  @Post("admin/deactivation/:userId/approve")
  approve(@Req() req: AuthenticatedRequest, @Param("userId") userId: string, @Body(new ZodValidationPipe(decisionSchema)) body: DecisionBody) {
    return decideDeactivation(this.db, userId, req.authUser.uid, "approved", body.note);
  }

  @Roles("admin")
  @Post("admin/deactivation/:userId/reject")
  reject(@Req() req: AuthenticatedRequest, @Param("userId") userId: string, @Body(new ZodValidationPipe(decisionSchema)) body: DecisionBody) {
    return decideDeactivation(this.db, userId, req.authUser.uid, "rejected", body.note);
  }

  @Roles("admin")
  @Get("admin/external-fees")
  listFees() {
    return listExternalSaleFees(this.db);
  }

  @Roles("admin")
  @Post("admin/external-fees/:id/decide")
  decideFee(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(feeDecisionSchema)) body: FeeDecisionBody) {
    return decideExternalSaleFee(this.db, id, req.authUser.uid, body.decision, body.note);
  }
}
