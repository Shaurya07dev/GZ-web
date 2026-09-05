import { Controller, Get, Inject, Param } from "@nestjs/common";
import { getPublicArtistProfile, type Db } from "@galleryzone/db";
import { Public } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";

@Controller("v1/artists")
export class PublicArtistsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Public()
  @Get(":id")
  get(@Param("id") id: string) {
    return getPublicArtistProfile(this.db, id);
  }
}
