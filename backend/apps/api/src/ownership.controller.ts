// Manual ownership / display transfers (the "Transfer rights" flow). Sale-
// triggered transfers never come through here — checkout.ts writes those
// when an order is paid. Only the two parties to a transfer can read it;
// everyone else gets a 404 (never a 403 that confirms the id exists).

import { Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import {
  acceptTransfer,
  cancelTransfer,
  Collections,
  endDisplay,
  getTransfer,
  initiateTransfer,
  OwnershipConflictError,
  OwnershipNotFoundError,
  type ArtworkDoc,
  type Db,
  type OwnershipEvent,
  type UserDoc,
} from "@galleryzone/db";
import { IllegalTransitionError } from "@galleryzone/domain";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";
import { toPublicEvent } from "./verify.controller.ts";

const initiateSchema = z
  .object({
    kind: z.enum(["ownership", "display"]).default("ownership"),
    toName: z.string().trim().min(2).max(120),
    toEmail: z.string().email(),
    displayEndsAt: z.string().datetime().optional(),
  })
  .strict();
type InitiateBody = z.infer<typeof initiateSchema>;

function problem(status: number, title: string, code: string) {
  return { type: "about:blank", title, status, code };
}

function rethrow(error: unknown): never {
  if (error instanceof OwnershipNotFoundError) throw new NotFoundException(problem(404, "Not found", "not_found"));
  if (error instanceof OwnershipConflictError) throw new ConflictException(problem(409, error.message, "conflict"));
  if (error instanceof IllegalTransitionError) throw new ConflictException(problem(409, error.message, "illegal_transition"));
  throw error;
}

/** A party's view: the public fields plus the invite email (they're one of the two people it concerns), the artwork id and title. */
async function toPartyDto(db: Db, e: OwnershipEvent) {
  const artwork = (await db.collection(Collections.artworks).doc(e.artworkId).get()).data() as ArtworkDoc | undefined;
  return { ...toPublicEvent(e), artworkId: e.artworkId, artworkTitle: artwork?.title ?? "Artwork", toEmail: e.toEmail };
}

@Controller("v1")
export class OwnershipController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("customer", "artist", "aggregator")
  @Post("artworks/:artworkId/transfers")
  async initiate(@Req() req: AuthenticatedRequest, @Param("artworkId") artworkId: string, @Body(new ZodValidationPipe(initiateSchema)) body: InitiateBody) {
    try {
      const event = await initiateTransfer(this.db, {
        artworkId,
        byUserId: req.authUser.uid,
        kind: body.kind,
        toName: body.toName,
        toEmail: body.toEmail,
        displayEndsAt: body.displayEndsAt ? new Date(body.displayEndsAt) : undefined,
      });
      return toPartyDto(this.db, event);
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("customer", "artist", "aggregator")
  @Get("transfers/:id")
  async get(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const event = await getTransfer(this.db, id);
    if (!event) throw new NotFoundException(problem(404, "Not found", "not_found"));
    const me = (await this.db.collection(Collections.users).doc(req.authUser.uid).get()).data() as UserDoc | undefined;
    const isParty = event.fromUserId === req.authUser.uid || event.toUserId === req.authUser.uid || (me && event.toEmail === me.email.toLowerCase());
    if (!isParty) throw new NotFoundException(problem(404, "Not found", "not_found"));
    return toPartyDto(this.db, event);
  }

  @Roles("customer", "artist", "aggregator")
  @Post("transfers/:id/accept")
  async accept(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    try {
      return toPartyDto(this.db, await acceptTransfer(this.db, { transferId: id, byUserId: req.authUser.uid }));
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("customer", "artist", "aggregator")
  @Post("transfers/:id/cancel")
  async cancel(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    try {
      return toPartyDto(this.db, await cancelTransfer(this.db, { transferId: id, byUserId: req.authUser.uid }));
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("customer", "artist", "aggregator")
  @Post("transfers/:id/end-display")
  async endDisplay(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    try {
      return toPartyDto(this.db, await endDisplay(this.db, { transferId: id, byUserId: req.authUser.uid }));
    } catch (error) {
      rethrow(error);
    }
  }
}
