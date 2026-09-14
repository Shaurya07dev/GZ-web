// In-process TTL cache for public reads. The marketplace listing is the
// hottest path in the system and its data changes on the order of minutes
// (an approval, a sale), so serving a 60-second-old copy is correct and
// turns N requests/minute into one Firestore query/minute per instance.
//
// Single-instance today (Railway). If the API is ever scaled horizontally
// each instance keeps its own copy — still correct, just N queries/minute
// — and the upgrade path is the same interface over Redis. Writers call
// invalidate() so the same instance never serves stale data to the person
// who just changed it.
//
// Requests that arrive while a fill is in flight share that promise
// (no thundering herd on a cold start).

import { Injectable, Logger } from "@nestjs/common";

interface Entry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class ReadCache {
  private readonly logger = new Logger(ReadCache.name);
  private readonly entries = new Map<string, Entry<unknown>>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  async getOrFill<T>(key: string, ttlMs: number, fill: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;

    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = fill()
      .then((value) => {
        this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  /** Drop one key, or every key under a prefix. */
  invalidate(keyOrPrefix: string): void {
    for (const key of this.entries.keys()) {
      if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) this.entries.delete(key);
    }
    this.logger.debug(`invalidated ${keyOrPrefix}`);
  }

  clear(): void {
    this.entries.clear();
  }
}

export const CacheKeys = {
  marketplace: "marketplace",
  artwork: (id: string) => `artwork:${id}`,
  artistArtworks: (artistId: string) => `artist-artworks:${artistId}`,
  verify: (id: string) => `verify:${id}`,
  artist: (id: string) => `artist:${id}`,
} as const;

export const TTL = {
  /** Listing + facets. */
  marketplace: 60_000,
  /** One artwork / passport — changes on sale or transfer; those paths invalidate explicitly. */
  artwork: 60_000,
  artist: 300_000,
} as const;
