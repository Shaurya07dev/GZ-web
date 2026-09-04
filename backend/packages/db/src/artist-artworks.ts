// Artist-side artwork submission. The mock frontend auto-approves on
// submit (no real moderation gate) — this backend fixes that: a new
// artwork starts at "pending_approval" via artworkStateMachine's actual
// table (draft -> pending_approval is legal; pending_approval -> marketplace
// only happens through adminService's future approveArtwork endpoint, an
// explicit admin action, never automatically).

import { and, count, desc, eq } from "drizzle-orm";
import { artworkStateMachine, editWindowExpiresAt, type PricingRates } from "@galleryzone/domain";
import type { Db } from "./client.ts";
import { artworks, artworkStatusEvents } from "./schema/artwork.ts";

export class ArtistArtworkError extends Error {}

export interface SubmitArtworkInput {
  db: Db;
  artistId: string;
  title: string;
  description: string;
  category: string;
  medium: string;
  artistPricePaise: number;
  listingType: "marketplace_only" | "aggregator_only" | "marketplace_and_aggregator";
  dimensions?: string | undefined;
  yearCreated?: number | undefined;
  rates: PricingRates;
}

// Product code sequence — plan.md §3.1's shape (AV000001, renamed to GZ
// here per the plan's Context section). Derived from a simple row count
// rather than a DB sequence object for now; a real Postgres SEQUENCE
// (gapless is not required — plan.md doesn't ask for gapless codes) is a
// one-line migration change once this needs to survive concurrent
// submissions at real volume, flagged here rather than silently assumed
// to be race-safe.
async function nextProductCode(db: Db): Promise<string> {
  const [row] = await db.select({ total: count() }).from(artworks);
  const n = (row?.total ?? 0) + 1;
  return `GZ${String(n).padStart(6, "0")}`;
}

export async function submitArtwork(input: SubmitArtworkInput): Promise<{ artworkId: string; productCode: string }> {
  const productCode = await nextProductCode(input.db);
  const now = new Date();

  const [artwork] = await input.db
    .insert(artworks)
    .values({
      productCode,
      artistId: input.artistId,
      title: input.title,
      description: input.description,
      category: input.category,
      medium: input.medium,
      dimensions: input.dimensions ?? null,
      yearCreated: input.yearCreated ?? null,
      artistPricePaise: input.artistPricePaise,
      listingType: input.listingType,
      editableUntil: editWindowExpiresAt(now, input.rates),
      createdAt: now,
    })
    .returning({ id: artworks.id });
  if (!artwork) throw new ArtistArtworkError("insert into artworks returned no row");

  await input.db.insert(artworkStatusEvents).values({ artworkId: artwork.id, status: "pending_approval" });

  return { artworkId: artwork.id, productCode };
}

export async function approveArtwork(db: Db, artworkId: string): Promise<void> {
  const [latest] = await db
    .select({ status: artworkStatusEvents.status })
    .from(artworkStatusEvents)
    .where(eq(artworkStatusEvents.artworkId, artworkId))
    .orderBy(desc(artworkStatusEvents.changedAt))
    .limit(1);
  const current = latest?.status ?? "draft";
  artworkStateMachine.assertTransition(current, "marketplace");
  await db.insert(artworkStatusEvents).values({ artworkId, status: "marketplace" });
}

export async function rejectArtwork(db: Db, artworkId: string, reason: string): Promise<void> {
  if (!reason) throw new ArtistArtworkError("A rejection requires a reason");
  const [latest] = await db
    .select({ status: artworkStatusEvents.status })
    .from(artworkStatusEvents)
    .where(eq(artworkStatusEvents.artworkId, artworkId))
    .orderBy(desc(artworkStatusEvents.changedAt))
    .limit(1);
  const current = latest?.status ?? "draft";
  artworkStateMachine.assertTransition(current, "returned");
  await db.insert(artworkStatusEvents).values({ artworkId, status: "returned", reason });
}

/** How many artworks this artist has ever submitted — feeds the rating-card composite score's artwork-count factor. */
export async function countArtistArtworks(db: Db, artistId: string): Promise<number> {
  const [row] = await db.select({ total: count() }).from(artworks).where(and(eq(artworks.artistId, artistId)));
  return row?.total ?? 0;
}
