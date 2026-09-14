// Certificate of Authenticity — physical certificate requests + a manual
// issuance fallback for admins. The certificate NUMBER itself is issued
// automatically when an artwork is approved (artist-artworks.ts ->
// coa.ts issueCertificate); the admin route exists for artworks approved
// before that hook shipped.

import { Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Post, Query, Req } from "@nestjs/common";
import { z } from "zod";
import {
  Collections,
  CoaConflictError,
  CoaNotFoundError,
  createPhysicalCoaRequest,
  issueCertificate,
  listPhysicalCoaRequestsForArtist,
  listPhysicalCoaRequestsForArtwork,
  markPhysicalCoaDispatched,
  type ArtworkDoc,
  type Db,
  type PhysicalCoaRequest,
} from "@galleryzone/db";
import { firestoreId } from "@galleryzone/contracts";
import { IllegalTransitionError } from "@galleryzone/domain";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const requestSchema = z
  .object({
    artworkId: firestoreId,
    delivery: z.object({ line1: z.string().min(1), city: z.string().min(1), state: z.string().min(1), pincode: z.string().min(1) }).strict(),
  })
  .strict();
type RequestBody = z.infer<typeof requestSchema>;

const dispatchSchema = z.object({ courierRef: z.string().min(1) }).strict();
type DispatchBody = z.infer<typeof dispatchSchema>;

const artworkIdQuery = z.object({ artworkId: firestoreId }).strict();
type ArtworkIdQuery = z.infer<typeof artworkIdQuery>;

function problem(status: number, title: string, code: string) {
  return { type: "about:blank", title, status, code };
}

/** Timestamps -> ISO so the wire shape is stable JSON, not Firestore's {_seconds,_nanoseconds}. */
function toDto(r: PhysicalCoaRequest) {
  return {
    id: r.id,
    artworkId: r.artworkId,
    requestedByUserId: r.requestedByUserId,
    requestedAt: r.requestedAt?.toDate().toISOString() ?? null,
    delivery: { line1: r.deliveryLine1, city: r.deliveryCity, state: r.deliveryState, pincode: r.deliveryPincode },
    status: r.status,
    dispatchedAt: r.dispatchedAt?.toDate().toISOString() ?? null,
    courierRef: r.courierRef,
  };
}

function rethrow(error: unknown): never {
  if (error instanceof CoaNotFoundError) throw new NotFoundException(problem(404, "Not found", "not_found"));
  if (error instanceof CoaConflictError) throw new ConflictException(problem(409, error.message, "conflict"));
  if (error instanceof IllegalTransitionError) throw new ConflictException(problem(409, error.message, "illegal_transition"));
  throw error;
}

@Controller("v1")
export class CoaController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("customer", "artist", "aggregator")
  @Post("coa/requests")
  async request(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(requestSchema)) body: RequestBody) {
    try {
      return toDto(await createPhysicalCoaRequest(this.db, { artworkId: body.artworkId, requestedByUserId: req.authUser.uid, delivery: body.delivery }));
    } catch (error) {
      rethrow(error);
    }
  }

  /** Requests for one artwork — the requester sees their own, the artist sees all for their piece, admins see all. */
  @Roles("customer", "artist", "aggregator", "admin")
  @Get("coa/requests")
  async listForArtwork(@Req() req: AuthenticatedRequest, @Query(new ZodValidationPipe(artworkIdQuery)) query: ArtworkIdQuery) {
    const [requests, artworkSnap] = await Promise.all([
      listPhysicalCoaRequestsForArtwork(this.db, query.artworkId),
      this.db.collection(Collections.artworks).doc(query.artworkId).get(),
    ]);
    const isArtist = (artworkSnap.data() as ArtworkDoc | undefined)?.artistId === req.authUser.uid;
    const isAdmin = req.authUser.role === "admin";
    return requests.filter((r) => isAdmin || isArtist || r.requestedByUserId === req.authUser.uid).map(toDto);
  }

  @Roles("artist")
  @Get("artist/coa/requests")
  async listForArtist(@Req() req: AuthenticatedRequest) {
    return (await listPhysicalCoaRequestsForArtist(this.db, req.authUser.uid)).map(toDto);
  }

  @Roles("artist")
  @Post("artist/coa/requests/:id/dispatch")
  async dispatch(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(dispatchSchema)) body: DispatchBody) {
    try {
      return toDto(await markPhysicalCoaDispatched(this.db, { requestId: id, artistId: req.authUser.uid, courierRef: body.courierRef }));
    } catch (error) {
      rethrow(error);
    }
  }

  /** Manual fallback: issue a certificate number to an artwork approved before automatic issuance existed. Idempotent. */
  @Roles("admin")
  @Post("admin/artworks/:id/coa/issue")
  async issue(@Param("id") id: string) {
    try {
      return await issueCertificate(this.db, id);
    } catch (error) {
      rethrow(error);
    }
  }
}
