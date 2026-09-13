// Admin dashboard reads + category CRUD — Firestore version.

import type { Firestore } from "firebase-admin/firestore";
import { Collections, artworkStatusEventsCol, type ArtworkStatusEventDoc, type CategoryDoc } from "./collections.ts";

export class AdminError extends Error {}

export interface AdminKpis {
  totalUsers: number;
  totalArtworks: number;
  pendingApprovalArtworks: number;
  pendingWithdrawals: number;
}

export async function getAdminKpis(db: Firestore): Promise<AdminKpis> {
  const [userCount, artworkSnap, pendingWithdrawalCount] = await Promise.all([
    db.collection(Collections.users).count().get(),
    db.collection(Collections.artworks).get(),
    db.collection(Collections.withdrawalRequests).where("status", "==", "pending").count().get(),
  ]);

  // "Pending approval" = the latest statusEvents doc per artwork is
  // pending_approval — no cheap aggregate query for this in Firestore, so
  // it's N reads (one per artwork). Fine at today's scale; flagged as the
  // first thing to denormalize (e.g. a `latestStatus` field on the
  // artwork doc itself, updated alongside each status event write) once
  // artwork volume makes this expensive.
  const statuses = await Promise.all(
    artworkSnap.docs.map(async (doc) => {
      const eventSnap = await db.collection(artworkStatusEventsCol(doc.id)).orderBy("changedAt", "desc").limit(1).get();
      return (eventSnap.docs[0]?.data() as ArtworkStatusEventDoc | undefined)?.status;
    }),
  );

  return {
    totalUsers: userCount.data().count,
    totalArtworks: artworkSnap.size,
    pendingApprovalArtworks: statuses.filter((s) => s === "pending_approval").length,
    pendingWithdrawals: pendingWithdrawalCount.data().count,
  };
}

export async function listCategories(db: Firestore): Promise<(CategoryDoc & { id: string })[]> {
  const snap = await db.collection(Collections.categories).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CategoryDoc) }));
}

export async function createCategory(db: Firestore, name: string, slug: string): Promise<{ id: string }> {
  const ref = db.collection(Collections.categories).doc();
  await ref.set({ name, slug });
  return { id: ref.id };
}

export async function updateCategory(db: Firestore, id: string, name: string): Promise<void> {
  const ref = db.collection(Collections.categories).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new AdminError(`No category ${id}`);
  await ref.update({ name });
}

/** Rejects if the category still holds artworks — matches the mock's own rule. */
export async function deleteCategory(db: Firestore, id: string): Promise<void> {
  const ref = db.collection(Collections.categories).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new AdminError(`No category ${id}`);
  const category = snap.data() as CategoryDoc;
  const inUseSnap = await db.collection(Collections.artworks).where("category", "==", category.name).count().get();
  if (inUseSnap.data().count > 0) {
    throw new AdminError(`Category "${category.name}" still has ${inUseSnap.data().count} artwork(s) — cannot delete`);
  }
  await ref.delete();
}
