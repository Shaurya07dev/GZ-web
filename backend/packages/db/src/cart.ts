// Per-user shopping cart — Firestore version.
//
// One doc per uid at carts/{uid}; the doc id and `userId` are the same so a
// stray cart from another account cannot even address a different id. The
// write path uses a Firestore transaction because add/remove read-then-write
// and two tabs can race; the max-cap check lives inside the transaction so
// an atomic double-add can't exceed it.
//
// Moved out of browser localStorage on 31 Oct 2026 — same reasoning the SAD
// records for the wishlist, which also moved: a logged-in cart is expected
// to follow the user across devices, and an abandoned-cart email can't fire
// without a server-side record.

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { Collections, type CartDoc, type CartEntry } from "./collections.ts";
import { DbError } from "./errors.ts";

export class CartError extends DbError {}

/** 20 is big enough for a collector's working set and small enough that a
 *  tampered client can't balloon the doc. Matches the web constant. */
export const CART_MAX_ITEMS = 20;

export interface Cart {
  entries: { artworkId: string; addedAt: string }[];
}

function toView(doc: CartDoc | undefined): Cart {
  if (!doc) return { entries: [] };
  return {
    entries: (doc.entries ?? []).map((e) => ({
      artworkId: e.artworkId,
      addedAt: e.addedAt?.toDate().toISOString() ?? new Date(0).toISOString(),
    })),
  };
}

export async function getCart(db: Firestore, uid: string): Promise<Cart> {
  const snap = await db.collection(Collections.carts).doc(uid).get();
  return toView(snap.data() as CartDoc | undefined);
}

/**
 * Puts `artworkId` into the cart. Idempotent: a second add returns the cart
 * unchanged (no duplicate entry, no cap bump). Throws CartError when the
 * cap is reached and the id isn't already in.
 *
 * `addedAt` on the entry is a concrete Timestamp built off `now`, not a
 * FieldValue — Firestore refuses sentinel values inside array elements.
 */
export async function addToCart(
  db: Firestore,
  uid: string,
  artworkId: string,
): Promise<Cart> {
  if (!artworkId.trim()) throw new CartError("artworkId required");
  const ref = db.collection(Collections.carts).doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data() as CartDoc | undefined;
    const entries = current?.entries ?? [];
    if (entries.some((e) => e.artworkId === artworkId)) {
      return toView(current);
    }
    if (entries.length >= CART_MAX_ITEMS) {
      throw new CartError(`A cart can hold at most ${CART_MAX_ITEMS} items.`);
    }
    const entry: CartEntry = {
      artworkId,
      addedAt: Timestamp.fromDate(new Date()),
    };
    const nextEntries = [...entries, entry];
    tx.set(ref, {
      userId: uid,
      entries: nextEntries,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return toView({
      userId: uid,
      entries: nextEntries,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  });
}

export async function removeFromCart(
  db: Firestore,
  uid: string,
  artworkId: string,
): Promise<Cart> {
  const ref = db.collection(Collections.carts).doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data() as CartDoc | undefined;
    if (!current) return { entries: [] };
    const nextEntries = current.entries.filter(
      (e) => e.artworkId !== artworkId,
    );
    if (nextEntries.length === current.entries.length) return toView(current);
    tx.set(ref, {
      userId: uid,
      entries: nextEntries,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return toView({ ...current, entries: nextEntries });
  });
}

export async function clearCart(db: Firestore, uid: string): Promise<Cart> {
  const ref = db.collection(Collections.carts).doc(uid);
  await ref.set(
    {
      userId: uid,
      entries: [] as CartEntry[],
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { entries: [] };
}
