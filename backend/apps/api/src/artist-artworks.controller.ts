// Artist artwork submission + the real admin moderation gate — closes the
// gap the mock frontend has (auto-approve on submit). Real work lives in
// @galleryzone/db/artist-artworks.ts, verified against real Postgres in
// artist-artworks.check.ts.

import { Body, Controller, Inject, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { submitArtwork, approveArtwork, rejectArtwork, FirestoreRateConfigStore, type Db } from "@galleryzone/db";
import { loadActiveRates } from "@galleryzone/config";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";
import { CacheKeys, ReadCache } from "./read-cache.ts";

const submitArtworkSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    category: z.string().min(1),
    medium: z.string().min(1),
    artistPricePaise: z.number().int().positive(),
    listingType: z.enum(["marketplace_only", "aggregator_only", "marketplace_and_aggregator"]),
    dimensions: z.string().optional(),
    yearCreated: z.number().int().optional(),
  })
  .strict();
type SubmitArtworkBody = z.infer<typeof submitArtworkSchema>;

const rejectSchema = z.object({ reason: z.string().min(1) }).strict();
type RejectBody = z.infer<typeof rejectSchema>;

@Controller("v1")
export class ArtistArtworksController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cache: ReadCache,
  ) {}

  private bust(artworkId: string, artistId?: string) {
    this.cache.invalidate(CacheKeys.marketplace);
    this.cache.invalidate(CacheKeys.artwork(artworkId));
    this.cache.invalidate(CacheKeys.verify(artworkId));
    if (artistId) this.cache.invalidate(CacheKeys.artistArtworks(artistId));
  }

  @Roles("artist")
  @Post("artist/artworks")
  async submit(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(submitArtworkSchema)) body: SubmitArtworkBody) {
    const rates = await loadActiveRates(new FirestoreRateConfigStore(this.db));
    const result = await submitArtwork({ db: this.db, artistId: req.authUser.uid, ...body, rates });
    this.bust(result.artworkId, req.authUser.uid);
    return result;
  }

  @Roles("admin")
  @Post("admin/artworks/:id/approve")
  async approve(@Param("id") id: string) {
    await approveArtwork(this.db, id);
    this.cache.clear();
    return { status: "marketplace" };
  }

  @Roles("admin")
  @Post("admin/artworks/:id/reject")
  async reject(@Param("id") id: string, @Body(new ZodValidationPipe(rejectSchema)) body: RejectBody) {
    await rejectArtwork(this.db, id, body.reason);
    this.cache.clear();
    return { status: "returned" };
  }
}
