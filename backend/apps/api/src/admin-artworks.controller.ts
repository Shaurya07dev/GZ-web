import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { listAllArtworksAdmin, setArtworkRarity, delistArtwork, getAuditLog, artworkRarityValues, reindexAllListings, refreshListing, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";
import { CacheKeys, ReadCache } from "./read-cache.ts";

const raritySchema = z.object({ rarity: z.enum([...artworkRarityValues]).nullable() }).strict();
type RarityBody = z.infer<typeof raritySchema>;

@Controller("v1/admin")
export class AdminArtworksController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cache: ReadCache,
  ) {}

  @Roles("admin")
  @Get("artworks")
  list() {
    return listAllArtworksAdmin(this.db);
  }

  @Roles("admin")
  @Post("artworks/:id/rarity")
  async setRarity(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(raritySchema)) body: RarityBody) {
    await setArtworkRarity(this.db, id, body.rarity, req.authUser.uid);
    this.cache.clear();
    return { rarity: body.rarity };
  }

  @Roles("admin")
  @Post("artworks/:id/delist")
  async delist(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    await delistArtwork(this.db, id, req.authUser.uid);
    this.cache.clear();
    return { status: "returned" };
  }

  /** Rebuild every artwork's denormalised listing projection (after a rate change, a migration, or on suspicion). */
  @Roles("admin")
  @Post("artworks/reindex")
  async reindex() {
    const count = await reindexAllListings(this.db);
    this.cache.clear();
    return { reindexed: count };
  }

  @Roles("admin")
  @Post("artworks/:id/reindex")
  async reindexOne(@Param("id") id: string) {
    const listing = await refreshListing(this.db, id);
    this.cache.clear();
    return { reindexed: listing ? 1 : 0 };
  }

  @Roles("admin")
  @Get("audit-log")
  auditLog() {
    return getAuditLog(this.db);
  }
}
