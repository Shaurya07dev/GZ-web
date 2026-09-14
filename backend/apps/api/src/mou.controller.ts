// MOU signing for artists and aggregators. GET returns the latest signed
// record (the frontend compares its version with the current document's
// and re-prompts on mismatch); POST records a new acceptance with the
// server's clock as the signing time.

import { Body, ConflictException, Controller, Get, Inject, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { getLatestMouAcceptance, MouError, recordMouAcceptance, type Db, type MouAcceptance, type MouParty } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const acceptSchema = z
  .object({
    version: z.string().trim().min(1).max(40),
    signatureName: z.string().trim().min(1).max(120),
    signatureDataUrl: z.string().max(300_000).nullable().optional(),
  })
  .strict();
type AcceptBody = z.infer<typeof acceptSchema>;

function toDto(a: MouAcceptance | null) {
  return a
    ? { party: a.party, version: a.version, signatureName: a.signatureName, signatureDataUrl: a.signatureDataUrl, acceptedAt: a.acceptedAt.toISOString() }
    : null;
}

async function accept(db: Db, uid: string, party: MouParty, body: AcceptBody) {
  try {
    return toDto(await recordMouAcceptance(db, { uid, party, version: body.version, signatureName: body.signatureName, signatureDataUrl: body.signatureDataUrl }));
  } catch (error) {
    if (error instanceof MouError) throw new ConflictException({ type: "about:blank", title: error.message, status: 409, code: "mou_rejected" });
    throw error;
  }
}

@Controller("v1")
export class MouController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("artist")
  @Get("artist/mou")
  async artistLatest(@Req() req: AuthenticatedRequest) {
    return { acceptance: toDto(await getLatestMouAcceptance(this.db, req.authUser.uid, "artist")) };
  }

  @Roles("artist")
  @Post("artist/mou/accept")
  artistAccept(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(acceptSchema)) body: AcceptBody) {
    return accept(this.db, req.authUser.uid, "artist", body);
  }

  @Roles("aggregator")
  @Get("aggregator/mou")
  async aggregatorLatest(@Req() req: AuthenticatedRequest) {
    return { acceptance: toDto(await getLatestMouAcceptance(this.db, req.authUser.uid, "aggregator")) };
  }

  @Roles("aggregator")
  @Post("aggregator/mou/accept")
  aggregatorAccept(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(acceptSchema)) body: AcceptBody) {
    return accept(this.db, req.authUser.uid, "aggregator", body);
  }
}
