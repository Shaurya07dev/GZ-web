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
  type UserDoc,
} from "@galleryzone/db";
import { firestoreId } from "@galleryzone/contracts";
import { IllegalTransitionError } from "@galleryzone/domain";
import { Roles } from "./auth/roles.decorator.ts";
import { Emails } from "./mail/emails.ts";
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

/**
 * Wire shape: timestamps as ISO (not Firestore's {_seconds,_nanoseconds}),
 * plus the artwork title / certificate number / requester name joined in so
 * the queue UI needs no follow-up reads. Names only — never the requester's
 * email or phone.
 */
async function toDtos(db: Db, requests: PhysicalCoaRequest[]) {
  const artworkIds = [...new Set(requests.map((r) => r.artworkId))];
  const userIds = [...new Set(requests.map((r) => r.requestedByUserId))];
  const [artworkSnaps, userSnaps] = await Promise.all([
    Promise.all(artworkIds.map((id) => db.collection(Collections.artworks).doc(id).get())),
    Promise.all(userIds.map((id) => db.collection(Collections.users).doc(id).get())),
  ]);
  const artworks = new Map(artworkSnaps.map((s) => [s.id, s.data() as ArtworkDoc | undefined]));
  const users = new Map(userSnaps.map((s) => [s.id, s.data() as UserDoc | undefined]));

  return requests.map((r) => ({
    id: r.id,
    artworkId: r.artworkId,
    artworkTitle: artworks.get(r.artworkId)?.title ?? "Artwork",
    coaCertificateNumber: artworks.get(r.artworkId)?.coaCertificateNumber ?? null,
    requestedByUserId: r.requestedByUserId,
    requestedByName: users.get(r.requestedByUserId)?.name ?? "Collector",
    requestedAt: r.requestedAt?.toDate().toISOString() ?? null,
    delivery: { line1: r.deliveryLine1, city: r.deliveryCity, state: r.deliveryState, pincode: r.deliveryPincode },
    status: r.status,
    dispatchedAt: r.dispatchedAt?.toDate().toISOString() ?? null,
    courierRef: r.courierRef,
  }));
}

async function toDto(db: Db, request: PhysicalCoaRequest) {
  return (await toDtos(db, [request]))[0]!;
}

function rethrow(error: unknown): never {
  if (error instanceof CoaNotFoundError) throw new NotFoundException(problem(404, "Not found", "not_found"));
  if (error instanceof CoaConflictError) throw new ConflictException(problem(409, error.message, "conflict"));
  if (error instanceof IllegalTransitionError) throw new ConflictException(problem(409, error.message, "illegal_transition"));
  throw error;
}

@Controller("v1")
export class CoaController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly emails: Emails,
  ) {}

  @Roles("customer", "artist", "aggregator")
  @Post("coa/requests")
  async request(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(requestSchema)) body: RequestBody) {
    try {
      const request = await createPhysicalCoaRequest(this.db, { artworkId: body.artworkId, requestedByUserId: req.authUser.uid, delivery: body.delivery });
      const dto = await toDto(this.db, request);
      const artwork = (await this.db.collection(Collections.artworks).doc(body.artworkId).get()).data() as ArtworkDoc | undefined;
      if (artwork) void this.emails.physicalCoaRequested({ requestId: dto.id, artistId: artwork.artistId, title: dto.artworkTitle, requestedByName: dto.requestedByName }).catch(this.emails.swallow("coa mail"));
      return dto;
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
    return toDtos(this.db, requests.filter((r) => isAdmin || isArtist || r.requestedByUserId === req.authUser.uid));
  }

  @Roles("artist")
  @Get("artist/coa/requests")
  async listForArtist(@Req() req: AuthenticatedRequest) {
    return toDtos(this.db, await listPhysicalCoaRequestsForArtist(this.db, req.authUser.uid));
  }

  @Roles("artist")
  @Post("artist/coa/requests/:id/dispatch")
  async dispatch(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(dispatchSchema)) body: DispatchBody) {
    try {
      return toDto(this.db, await markPhysicalCoaDispatched(this.db, { requestId: id, artistId: req.authUser.uid, courierRef: body.courierRef }));
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
