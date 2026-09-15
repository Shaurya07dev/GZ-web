import { Controller, Get, Header, Inject, NotFoundException, Param } from "@nestjs/common";
import { getPublicArtistProfile, listArtistPublicArtworks, listPublicArtists, publicStats, ProfileError, type Db } from "@galleryzone/db";
import type { CustomerArtworkDto } from "@galleryzone/contracts";
import { Public } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { CacheKeys, ReadCache, TTL } from "./read-cache.ts";

const PUBLIC_CACHE = "public, max-age=30, s-maxage=60, stale-while-revalidate=60";

@Controller("v1/stats")
export class PublicStatsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cache: ReadCache,
  ) {}

  @Public()
  @Get("public")
  @Header("Cache-Control", "public, max-age=300, s-maxage=600")
  stats() {
    return this.cache.getOrFill("stats:public", TTL.artist, () => publicStats(this.db));
  }
}

@Controller("v1/artists")
export class PublicArtistsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cache: ReadCache,
  ) {}

  /** Directory: every artist with a live listing. */
  @Public()
  @Get()
  @Header("Cache-Control", PUBLIC_CACHE)
  async list() {
    const artists = await this.cache.getOrFill("artists:directory", TTL.marketplace, () => listPublicArtists(this.db));
    return { artists };
  }

  @Public()
  @Get(":id")
  @Header("Cache-Control", PUBLIC_CACHE)
  async get(@Param("id") id: string) {
    try {
      return await this.cache.getOrFill(CacheKeys.artist(id), TTL.artist, () => getPublicArtistProfile(this.db, id));
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
  @Header("Cache-Control", PUBLIC_CACHE)
  async artworks(@Param("id") id: string): Promise<{ artworks: CustomerArtworkDto[] }> {
    const artworks = await this.cache.getOrFill(CacheKeys.artistArtworks(id), TTL.marketplace, () => listArtistPublicArtworks(this.db, id));
    return { artworks };
  }
}
