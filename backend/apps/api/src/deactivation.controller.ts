import { Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { requestDeactivation, decideDeactivation, listExternalSaleFees, decideExternalSaleFee, Collections, DeactivationError, type Db, type ExternalSalePenaltyDoc, getDeactivationRequest, listDeactivationRequests } from "@galleryzone/db";
import { IllegalTransitionError } from "@galleryzone/domain";
import { Roles } from "./auth/roles.decorator.ts";
import { Emails } from "./mail/emails.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const requestSchema = z.object({ reason: z.string().min(1) }).strict();
type RequestBody = z.infer<typeof requestSchema>;
const decisionSchema = z.object({ note: z.string().optional() }).strict();
type DecisionBody = z.infer<typeof decisionSchema>;
const feeDecisionSchema = z.object({ decision: z.enum(["approved", "waived"]), note: z.string().optional() }).strict();
type FeeDecisionBody = z.infer<typeof feeDecisionSchema>;

// DeactivationError reached the console as a 500 — including "already
// decided", which an admin hits by double-clicking.
function rethrow(error: unknown): never {
  if (error instanceof DeactivationError) {
    if (error.message.startsWith("No ")) {
      throw new NotFoundException({ type: "about:blank", title: "Not found", status: 404, code: "not_found" });
    }
    throw new ConflictException({ type: "about:blank", title: error.message, status: 409, code: "conflict" });
  }
  if (error instanceof IllegalTransitionError) {
    throw new ConflictException({ type: "about:blank", title: error.message, status: 409, code: "illegal_transition" });
  }
  throw error;
}

@Controller("v1")
export class DeactivationController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly emails: Emails,
  ) {}

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
  async request(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(requestSchema)) body: RequestBody) {
    try {
      const result = await requestDeactivation(this.db, req.authUser.uid, body.reason);
      void this.emails.deactivationRequested({ userId: req.authUser.uid, reason: body.reason }).catch(this.emails.swallow("deactivation mail"));
      return result;
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("admin")
  @Post("admin/deactivation/:userId/approve")
  async approve(@Req() req: AuthenticatedRequest, @Param("userId") userId: string, @Body(new ZodValidationPipe(decisionSchema)) body: DecisionBody) {
    try {
      const result = await decideDeactivation(this.db, userId, req.authUser.uid, "approved", body.note);
      void this.emails.deactivationDecided({ userId, approved: true, note: body.note }).catch(this.emails.swallow("deactivation mail"));
      return result;
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("admin")
  @Post("admin/deactivation/:userId/reject")
  async reject(@Req() req: AuthenticatedRequest, @Param("userId") userId: string, @Body(new ZodValidationPipe(decisionSchema)) body: DecisionBody) {
    try {
      const result = await decideDeactivation(this.db, userId, req.authUser.uid, "rejected", body.note);
      void this.emails.deactivationDecided({ userId, approved: false, note: body.note }).catch(this.emails.swallow("deactivation mail"));
      return result;
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("admin")
  @Get("admin/external-fees")
  listFees() {
    return listExternalSaleFees(this.db);
  }

  @Roles("admin")
  @Post("admin/external-fees/:id/decide")
  async decideFee(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(feeDecisionSchema)) body: FeeDecisionBody) {
    // Read the penalty first: afterwards we still need the artist and the
    // amount to tell them what was decided about money they owe.
    const penalty = (await this.db.collection(Collections.externalSalePenalties).doc(id).get()).data() as ExternalSalePenaltyDoc | undefined;
    try {
      const result = await decideExternalSaleFee(this.db, id, req.authUser.uid, body.decision, body.note);
      if (penalty) {
        const artwork = (await this.db.collection(Collections.artworks).doc(penalty.artworkId).get()).data() as { title?: string; artistId?: string } | undefined;
        if (artwork?.artistId) {
          void this.emails
            .externalSaleFeeDecided({
              penaltyId: id,
              artistId: artwork.artistId,
              title: artwork.title ?? "your artwork",
              amountPaise: penalty.amountPaise,
              waived: body.decision === "waived",
              note: body.note,
            })
            .catch(this.emails.swallow("external fee mail"));
        }
      }
      return result;
    } catch (error) {
      rethrow(error);
    }
  }
}
