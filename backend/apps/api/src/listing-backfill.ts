// One-shot projection backfill at boot. Firestore can't query for "docs
// missing the listing field", so while the catalogue is small the simplest
// correct thing is to rebuild every projection once per process start —
// a few hundred reads, in the background, never blocking the health check.
// Disable with LISTING_REINDEX_ON_BOOT=false once the catalogue is large
// enough that the admin reindex route is the better tool.

import { Inject, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { reindexAllListings, type Db } from "@galleryzone/db";
import { DB } from "./db.module.ts";
import { ReadCache } from "./read-cache.ts";

@Injectable()
export class ListingBackfill implements OnApplicationBootstrap {
  private readonly logger = new Logger(ListingBackfill.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cache: ReadCache,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.LISTING_REINDEX_ON_BOOT === "false") return;
    void reindexAllListings(this.db)
      .then((count) => {
        this.cache.clear();
        this.logger.log(`listing projection rebuilt for ${count} artwork(s)`);
      })
      .catch((error) => this.logger.error(`listing backfill failed: ${String(error)}`));
  }
}
