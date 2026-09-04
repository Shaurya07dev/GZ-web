// Artist artwork submission + the real admin moderation gate — closes the
// gap the mock frontend has (auto-approve on submit). Real work lives in
// @galleryzone/db/artist-artworks.ts, verified against real Postgres in
// artist-artworks.check.ts.

import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { submitArtwork, approveArtwork, rejectArtwork, PostgresRateConfigStore, type Db } from "@galleryzone/db";
import { loadActiveRates } from "@galleryzone/config";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

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
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("artist")
  @Post("artist/artworks")
  async submit(@Body(new ZodValidationPipe(submitArtworkSchema)) body: SubmitArtworkBody) {
    const rates = await loadActiveRates(new PostgresRateConfigStore(this.db));
    // TODO(Phase 1): artistId from the authenticated request.
    return submitArtwork({ db: this.db, artistId: "TODO-authenticated-user-id", ...body, rates });
  }

  @Roles("admin")
  @Post("admin/artworks/:id/approve")
  async approve(@Param("id") id: string) {
    await approveArtwork(this.db, id);
    return { status: "marketplace" };
  }

  @Roles("admin")
  @Post("admin/artworks/:id/reject")
  async reject(@Param("id") id: string, @Body(new ZodValidationPipe(rejectSchema)) body: RejectBody) {
    await rejectArtwork(this.db, id, body.reason);
    return { status: "returned" };
  }
}
