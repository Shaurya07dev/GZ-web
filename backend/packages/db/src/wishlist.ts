// Per-user wishlist and follows — Firestore versions.
//
// Both shapes are the same: one doc per uid at /{wishlists|follows}/{uid}
// with a list of ids and timestamps. Owned by the user, read/write by them,
// never by anyone else. Idempotent adds/removes so a double-tap can't
// double-write.
//
// Added 8 Nov 2026 — both were client-side localStorage before. Moving to
// Firestore means a saved artwork survives reinstall and appears on every
// device the user signs in on; artists can (eventually) see which pieces
// have the most saves; and a followed artist can push a notification when
// they upload something new.

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  Collections,
  type FollowEntry,
  type FollowsDoc,
  type WishlistDoc,
  type WishlistEntry,
} from "./collections.ts";

// --- Wishlist --------------------------------------------------------------

const WISHLIST_MAX = 200;

export interface Wishlist {
  entries: { artworkId: string; addedAt: string }[];
}

function wishlistView(doc: WishlistDoc | undefined): Wishlist {
  if (!doc) return { entries: [] };
  return {
    entries: (doc.entries ?? []).map((e) => ({
      artworkId: e.artworkId,
      addedAt: e.addedAt?.toDate().toISOString() ?? new Date(0).toISOString(),
    })),
  };
}

export async function getWishlist(db: Firestore, uid: string): Promise<Wishlist> {
  const snap = await db.collection(Collections.wishlists).doc(uid).get();
  return wishlistView(snap.data() as WishlistDoc | undefined);
}

export async function addToWishlist(db: Firestore, uid: string, artworkId: string): Promise<Wishlist> {
  const ref = db.collection(Collections.wishlists).doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = (snap.data() as WishlistDoc | undefined)?.entries ?? [];
    if (existing.some((e) => e.artworkId === artworkId)) return;
    if (existing.length >= WISHLIST_MAX) {
      throw new Error(`Wishlist is full (max ${WISHLIST_MAX} items). Remove something first.`);
    }
    const now = Timestamp.now();
    const entry: WishlistEntry = { artworkId, addedAt: now };
    if (snap.exists) {
      tx.update(ref, {
        entries: FieldValue.arrayUnion(entry),
        updatedAt: now,
      });
    } else {
      tx.set(ref, {
        userId: uid,
        entries: [entry],
        updatedAt: now,
      } satisfies WishlistDoc);
    }
  });
  return getWishlist(db, uid);
}

export async function removeFromWishlist(db: Firestore, uid: string, artworkId: string): Promise<Wishlist> {
  const ref = db.collection(Collections.wishlists).doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = (snap.data() as WishlistDoc | undefined)?.entries ?? [];
    const next = existing.filter((e) => e.artworkId !== artworkId);
    if (next.length === existing.length) return; // idempotent
    tx.update(ref, { entries: next, updatedAt: Timestamp.now() });
  });
  return getWishlist(db, uid);
}

// --- Follows ---------------------------------------------------------------

const FOLLOWS_MAX = 500;

export interface Follows {
  entries: { artistId: string; followedAt: string }[];
}

function followsView(doc: FollowsDoc | undefined): Follows {
  if (!doc) return { entries: [] };
  return {
    entries: (doc.entries ?? []).map((e) => ({
      artistId: e.artistId,
      followedAt: e.followedAt?.toDate().toISOString() ?? new Date(0).toISOString(),
    })),
  };
}

export async function getFollows(db: Firestore, uid: string): Promise<Follows> {
  const snap = await db.collection(Collections.follows).doc(uid).get();
  return followsView(snap.data() as FollowsDoc | undefined);
}

export async function followArtist(db: Firestore, uid: string, artistId: string): Promise<Follows> {
  const ref = db.collection(Collections.follows).doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = (snap.data() as FollowsDoc | undefined)?.entries ?? [];
    if (existing.some((e) => e.artistId === artistId)) return;
    if (existing.length >= FOLLOWS_MAX) {
      throw new Error(`You already follow ${FOLLOWS_MAX} artists — the limit.`);
    }
    const now = Timestamp.now();
    const entry: FollowEntry = { artistId, followedAt: now };
    if (snap.exists) {
      tx.update(ref, {
        entries: FieldValue.arrayUnion(entry),
        updatedAt: now,
      });
    } else {
      tx.set(ref, {
        userId: uid,
        entries: [entry],
        updatedAt: now,
      } satisfies FollowsDoc);
    }
  });
  return getFollows(db, uid);
}

export async function unfollowArtist(db: Firestore, uid: string, artistId: string): Promise<Follows> {
  const ref = db.collection(Collections.follows).doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = (snap.data() as FollowsDoc | undefined)?.entries ?? [];
    const next = existing.filter((e) => e.artistId !== artistId);
    if (next.length === existing.length) return;
    tx.update(ref, { entries: next, updatedAt: Timestamp.now() });
  });
  return getFollows(db, uid);
}
