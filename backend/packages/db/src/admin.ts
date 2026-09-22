// Admin dashboard reads + category CRUD — Firestore version.

import type { Firestore } from "firebase-admin/firestore";
import { Collections, artworkStatusEventsCol, type ArtworkStatusEventDoc, type CategoryDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class AdminError extends DbError {}

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
