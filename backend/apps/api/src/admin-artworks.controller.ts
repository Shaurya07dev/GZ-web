import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { listAllArtworksAdmin, setArtworkRarity, delistArtwork, getAuditLog, artworkRarityValues, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
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
  setRarity(@Param("id") id: string, @Body(new ZodValidationPipe(raritySchema)) body: RarityBody) {
    // TODO(Phase 1): adminId from the authenticated request.
    return setArtworkRarity(this.db, id, body.rarity, "TODO-authenticated-user-id");
  }

  @Roles("admin")
  @Post("artworks/:id/delist")
  delist(@Param("id") id: string) {
    return delistArtwork(this.db, id, "TODO-authenticated-user-id");
  }

  @Roles("admin")
  @Get("audit-log")
  auditLog() {
    return getAuditLog(this.db);
  }
}
