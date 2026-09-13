// The marketplace listing/detail endpoints — the highest-traffic read path
// in the whole system. Public: no auth required, but SECURITY-CRITICAL
// regardless — see packages/db/public-artworks.ts, which owns the DTO
// construction and the price-leak discipline. This controller is thin.

import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { getPublicArtwork, listMarketplaceArtworks, type Db } from "@galleryzone/db";
import type { CustomerArtworkDto } from "@galleryzone/contracts";
import { Public } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";

@Controller("v1/artworks")
export class ArtworksController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Only pieces currently on the marketplace (status projected from statusEvents), never drafts/pending/sold. */
  @Public()
  @Get()
  async list(): Promise<{ artworks: CustomerArtworkDto[] }> {
    return { artworks: await listMarketplaceArtworks(this.db) };
  }

  /** Any status — a passport/COA link must still resolve after a sale. */
  @Public()
  @Get(":id")
  async get(@Param("id") id: string): Promise<CustomerArtworkDto> {
    const artwork = await getPublicArtwork(this.db, id);
    if (!artwork) throw new NotFoundException({ type: "about:blank", title: "Artwork not found", status: 404, code: "not_found" });
    return artwork;
  }
}
