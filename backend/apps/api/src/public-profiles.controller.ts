import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { getPublicArtistProfile, listArtistPublicArtworks, ProfileError, type Db } from "@galleryzone/db";
import type { CustomerArtworkDto } from "@galleryzone/contracts";
import { Public } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";

@Controller("v1/artists")
export class PublicArtistsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Public()
  @Get(":id")
  async get(@Param("id") id: string) {
    try {
      return await getPublicArtistProfile(this.db, id);
    } catch (error) {
      if (error instanceof ProfileError) {
        throw new NotFoundException({ type: "about:blank", title: "Artist not found", status: 404, code: "not_found" });
      }
      throw error;
    }
  }

  /** This artist's marketplace listings — the artist page's rail. */
  @Public()
  @Get(":id/artworks")
  async artworks(@Param("id") id: string): Promise<{ artworks: CustomerArtworkDto[] }> {
    return { artworks: await listArtistPublicArtworks(this.db, id) };
  }
}
