// Admin dashboard reads + category CRUD. Straightforward queries — the
// interesting logic (state machines, ledger, pricing) lives in the more
// specific modules this file doesn't duplicate.

import { count, eq, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { users } from "./schema/identity.ts";
import { artworks, artworkStatusEvents, categories } from "./schema/artwork.ts";
import { withdrawalRequests } from "./schema/ledger.ts";

export class AdminError extends Error {}

export interface AdminKpis {
  totalUsers: number;
  totalArtworks: number;
  pendingApprovalArtworks: number;
  pendingWithdrawals: number;
}

export async function getAdminKpis(db: Db): Promise<AdminKpis> {
  const [[userTotal], [artworkTotal], [pendingWithdrawalTotal]] = await Promise.all([
    db.select({ total: count() }).from(users),
    db.select({ total: count() }).from(artworks),
    db.select({ total: count() }).from(withdrawalRequests).where(eq(withdrawalRequests.status, "pending")),
  ]);

  // "Pending approval" = the latest status event per artwork is
  // pending_approval — a small correlated-subquery since status isn't a
  // stored column on artworks itself (append-only event log is the source
  // of truth, per the schema's own comment).
  const [pendingApproval] = await db.execute<{ total: string }>(sql`
    select count(*)::text as total
    from ${artworks} a
    where (
      select ase.status
      from ${artworkStatusEvents} ase
      where ase.artwork_id = a.id
      order by ase.changed_at desc
      limit 1
    ) = 'pending_approval'
  `);

  return {
    totalUsers: userTotal?.total ?? 0,
    totalArtworks: artworkTotal?.total ?? 0,
    pendingApprovalArtworks: Number(pendingApproval?.total ?? 0),
    pendingWithdrawals: pendingWithdrawalTotal?.total ?? 0,
  };
}

export async function listCategories(db: Db) {
  return db.select().from(categories);
}

export async function createCategory(db: Db, name: string, slug: string): Promise<{ id: string }> {
  const [row] = await db.insert(categories).values({ name, slug }).returning({ id: categories.id });
  if (!row) throw new AdminError("insert into categories returned no row");
  return row;
}

export async function updateCategory(db: Db, id: string, name: string): Promise<void> {
  const result = await db.update(categories).set({ name }).where(eq(categories.id, id));
  if (result.count === 0) throw new AdminError(`No category ${id}`);
}

/** Rejects if the category still holds artworks — matches the mock's own rule. */
export async function deleteCategory(db: Db, id: string): Promise<void> {
  const [category] = await db.select({ name: categories.name }).from(categories).where(eq(categories.id, id));
  if (!category) throw new AdminError(`No category ${id}`);
  const [inUse] = await db.select({ total: count() }).from(artworks).where(eq(artworks.category, category.name));
  if ((inUse?.total ?? 0) > 0) {
    throw new AdminError(`Category "${category.name}" still has ${inUse?.total} artwork(s) — cannot delete`);
  }
  await db.delete(categories).where(eq(categories.id, id));
}
