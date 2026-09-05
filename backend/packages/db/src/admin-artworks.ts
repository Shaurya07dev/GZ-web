// Admin's all-artworks view (includes artistPricePaise — admin is one of
// the three parties plan.md §8 allows to see it, alongside the owning
// artist and an aggregator with an active consignment) plus rarity
// ranking and delisting.

import { desc, eq, sql } from "drizzle-orm";
import { artworkStateMachine } from "@galleryzone/domain";
import type { Db } from "./client.ts";
import { artworkRarityValues, artworks, artworkStatusEvents, type ArtworkRarity } from "./schema/artwork.ts";
import { auditLog } from "./schema/audit.ts";

export class AdminArtworkError extends Error {}

export interface AdminArtworkRow {
  id: string;
  productCode: string;
  artistId: string;
  title: string;
  category: string;
  artistPricePaise: number;
  rarityType: ArtworkRarity | null;
  status: string;
}

export async function listAllArtworksAdmin(db: Db): Promise<AdminArtworkRow[]> {
  const rows = await db
    .select({
      id: artworks.id,
      productCode: artworks.productCode,
      artistId: artworks.artistId,
      title: artworks.title,
      category: artworks.category,
      artistPricePaise: artworks.artistPricePaise,
      rarityType: artworks.rarityType,
    })
    .from(artworks);

  // One correlated subquery for "latest status" per row, same pattern as
  // admin.ts's getAdminKpis() — status is an event log, not a column.
  const withStatus = await Promise.all(
    rows.map(async (row) => {
      const [latest] = await db
        .select({ status: artworkStatusEvents.status })
        .from(artworkStatusEvents)
        .where(eq(artworkStatusEvents.artworkId, row.id))
        .orderBy(desc(artworkStatusEvents.changedAt))
        .limit(1);
      return { ...row, status: latest?.status ?? "draft" };
    }),
  );
  return withStatus;
}

export async function setArtworkRarity(db: Db, artworkId: string, rarity: ArtworkRarity | null, adminId: string): Promise<void> {
  if (rarity !== null && !artworkRarityValues.includes(rarity)) throw new AdminArtworkError(`Invalid rarity ${rarity}`);
  await db.transaction(async (tx) => {
    const result = await tx.update(artworks).set({ rarityType: rarity }).where(eq(artworks.id, artworkId));
    if (result.count === 0) throw new AdminArtworkError(`No artwork ${artworkId}`);
    await tx.insert(auditLog).values({ adminId, action: "artwork.rarity_set", entityType: "artwork", entityId: artworkId, detail: { rarity } });
  });
}

export async function delistArtwork(db: Db, artworkId: string, adminId: string): Promise<void> {
  const [latest] = await db
    .select({ status: artworkStatusEvents.status })
    .from(artworkStatusEvents)
    .where(eq(artworkStatusEvents.artworkId, artworkId))
    .orderBy(desc(artworkStatusEvents.changedAt))
    .limit(1);
  const current = latest?.status ?? "draft";
  artworkStateMachine.assertTransition(current, "returned");

  await db.transaction(async (tx) => {
    await tx.insert(artworkStatusEvents).values({ artworkId, status: "returned", changedBy: adminId, reason: "Delisted by admin" });
    await tx.insert(auditLog).values({ adminId, action: "artwork.delisted", entityType: "artwork", entityId: artworkId });
  });
}

export async function getAuditLog(db: Db, limit = 100) {
  return db.select().from(auditLog).orderBy(sql`${auditLog.createdAt} desc`).limit(limit);
}
