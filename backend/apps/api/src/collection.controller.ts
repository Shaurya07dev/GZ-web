// GET /v1/account/collection — what the signed-in collector owns, from the
// ownership ledger (not from orders: a piece received by transfer has no
// order, a resold piece has an order but is no longer theirs). Each entry
// carries the public artwork view and, when there is one, the order.

import { Controller, Get, Inject, Req } from "@nestjs/common";
import { getOrder, getPublicArtwork, listCollection, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";

@Controller("v1/account")
export class CollectionController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("customer", "artist", "aggregator")
  @Get("collection")
  async list(@Req() req: AuthenticatedRequest) {
    const entries = await listCollection(this.db, req.authUser.uid);
    const items = await Promise.all(
      entries.map(async (e) => {
        const [artwork, order] = await Promise.all([getPublicArtwork(this.db, e.artworkId), e.orderId ? getOrder(this.db, e.orderId) : null]);
        if (!artwork) return null;
        return { artwork, order, source: e.source, acquiredAt: e.acquiredAt.toISOString(), fromName: e.fromName };
      }),
    );
    return { items: items.filter((i) => i !== null) };
  }
}
