import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { listAllArtworksAdmin, setArtworkRarity, delistArtwork, getAuditLog, artworkRarityValues, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const raritySchema = z.object({ rarity: z.enum([...artworkRarityValues]).nullable() }).strict();
type RarityBody = z.infer<typeof raritySchema>;

@Controller("v1/admin")
export class AdminArtworksController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("admin")
  @Get("artworks")
  list() {
    return listAllArtworksAdmin(this.db);
  }

  @Roles("admin")
  @Post("artworks/:id/rarity")
  setRarity(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(raritySchema)) body: RarityBody) {
    return setArtworkRarity(this.db, id, body.rarity, req.authUser.uid);
  }

  @Roles("admin")
  @Post("artworks/:id/delist")
  delist(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return delistArtwork(this.db, id, req.authUser.uid);
  }

  @Roles("admin")
  @Get("audit-log")
  auditLog() {
    return getAuditLog(this.db);
  }
}
