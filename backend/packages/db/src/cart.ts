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

// --- Abandoned cart sweep --------------------------------------------------

export interface AbandonedCart {
  userId: string;
  /** First (earliest-added) entry — the one the mail quotes by title. */
  firstEntry: { artworkId: string; addedAt: Date };
  /** How many OTHER entries are also sitting unpaid. */
  extraCount: number;
  /** Deterministic key so the mailer idempotently dedupes resends across
   *  restarts: uid + first-entry-addedAt-epoch. If the buyer adds something
   *  new or removes the first entry, the key changes and a reminder goes
   *  out for the next-oldest entry. */
  cartEntryKey: string;
}

/**
 * Finds carts whose earliest entry is older than [ageHours] and newer than
 * [maxAgeHours] (so we don't keep reminding on a cart that's been there for
 * a week). Returns at most [limit] rows so one bad sweep can't fan out
 * mail to every account.
 *
 * We use a Firestore collection scan here, filtered in-memory. At launch
 * volume (<10k carts) that's a few hundred ms once an hour; if we outgrow
 * it, a `firstEntryAt` denormalised field + range query is the path.
 */
export async function findAbandonedCarts(
  db: Firestore,
  options: { ageHours: number; maxAgeHours: number; limit: number },
): Promise<AbandonedCart[]> {
  const now = Date.now();
  const earliest = now - options.ageHours * 60 * 60_000;
  const latest = now - options.maxAgeHours * 60 * 60_000;
  const snap = await db.collection(Collections.carts).limit(500).get();
  const due: AbandonedCart[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as import("./collections.ts").CartDoc;
    const entries = (data.entries ?? [])
      .filter((e) => e?.addedAt)
      .sort((a, b) => a.addedAt.toMillis() - b.addedAt.toMillis());
    if (entries.length === 0) continue;
    const first = entries[0]!;
    const firstAtMs = first.addedAt.toMillis();
    if (firstAtMs > earliest) continue; // too fresh
    if (firstAtMs < latest) continue; // too old, don't nag forever
    due.push({
      userId: data.userId,
      firstEntry: { artworkId: first.artworkId, addedAt: first.addedAt.toDate() },
      extraCount: entries.length - 1,
      cartEntryKey: `${data.userId}-${Math.floor(firstAtMs / 1000)}`,
    });
    if (due.length >= options.limit) break;
  }
  return due;
}
