// Short-lived hold on a one-of-a-kind artwork while a buyer walks to
// Razorpay. Prevents the double-sale race — two buyers click Buy Now at
// the same time, both reach Razorpay, both pay, only one can get the
// painting. Reservations are per-artwork (one doc per artworkId); holding
// one is pre-requisite to createOrder for a marketplace piece.
//
// Lifecycle:
//   1. Buyer clicks Buy Now → `claimReservation(artworkId, customerId)`
//      atomically tries to write the hold. If no hold exists, or the
//      existing hold is expired, or the existing hold belongs to the same
//      customer, the claim succeeds. If a different, still-valid hold
//      exists, we throw.
//   2. Buyer completes payment → `clearReservation(artworkId)` fires
//      from markOrderPaid.
//   3. Buyer abandons payment or the timer expires → next claim overwrites
//      silently, OR the public /artworks/:id endpoint sees the stale doc
//      and reads `reservedUntil < now` as "available".
//
// Why not a sub-collection of artworks? One doc per artwork keeps the
// atomic transaction cheap (single-doc read-then-write), lets us delete
// the hold without cascading effects, and makes the read path on the
// public artwork detail one extra get() rather than a collection query.

import { FieldValue, type Firestore, type Timestamp } from "firebase-admin/firestore";
import { Collections } from "./collections.ts";
import { DbError } from "./errors.ts";

export class ReservationError extends DbError {}

/** How long a buyer has to walk to Razorpay and pay, from the Buy Now click. */
export const RESERVATION_WINDOW_MS = 10 * 60 * 1000;

export interface ArtworkReservationDoc {
  artworkId: string;
  customerId: string;
  /** Timestamp after which this hold is no longer in force. */
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export interface ActiveReservationView {
  artworkId: string;
  customerId: string;
  expiresAt: string;
  secondsRemaining: number;
}

export function artworkReservationRef(db: Firestore, artworkId: string) {
  return db.collection(Collections.artworkReservations).doc(artworkId);
}

/**
 * Atomically claim (or renew) a reservation on an artwork. Returns the
 * new `expiresAt`. Throws `ReservationError` with a human-readable message
 * if a different customer already holds a valid reservation.
 *
 * Inside a transaction so two simultaneous "Buy Now" clicks resolve
 * deterministically — Firestore's optimistic concurrency retries the
 * second caller against the first caller's committed write.
 */
export async function claimReservation(
  db: Firestore,
  artworkId: string,
  customerId: string,
): Promise<ActiveReservationView> {
  const ref = artworkReservationRef(db, artworkId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const nowMs = Date.now();
    if (snap.exists) {
      const current = snap.data() as ArtworkReservationDoc;
      const currentExpiresMs = current.expiresAt?.toMillis?.() ?? 0;
      const stillValid = currentExpiresMs > nowMs;
      const heldByOther = stillValid && current.customerId !== customerId;
      if (heldByOther) {
        throw new ReservationError(
          "Another collector is completing their checkout for this piece right now. Try again in a few minutes.",
        );
      }
    }
    const expiresAtMs = nowMs + RESERVATION_WINDOW_MS;
    tx.set(ref, {
      artworkId,
      customerId,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(expiresAtMs),
    });
    return { expiresAtMs };
  });
  return {
    artworkId,
    customerId,
    expiresAt: new Date(result.expiresAtMs).toISOString(),
    secondsRemaining: Math.max(0, Math.floor((result.expiresAtMs - Date.now()) / 1000)),
  };
}

/** Clear a reservation after a successful sale. Idempotent. */
export async function clearReservation(db: Firestore, artworkId: string): Promise<void> {
  await artworkReservationRef(db, artworkId).delete().catch(() => undefined);
}

/**
 * Read the current reservation state for a piece. Used by the public
 * artwork detail page to render "Reserved · 7m left" (or "Your hold")
 * so the buyer sees why Buy Now is disabled.
 *
 * Expired reservations return null (we don't delete them here — the next
 * claim transaction will overwrite, which is cheaper than two writes for
 * one event).
 */
export async function readActiveReservation(
  db: Firestore,
  artworkId: string,
): Promise<ActiveReservationView | null> {
  const snap = await artworkReservationRef(db, artworkId).get();
  if (!snap.exists) return null;
  const data = snap.data() as ArtworkReservationDoc;
  const expiresMs = data.expiresAt?.toMillis?.() ?? 0;
  const nowMs = Date.now();
  if (expiresMs <= nowMs) return null;
  return {
    artworkId: data.artworkId,
    customerId: data.customerId,
    expiresAt: new Date(expiresMs).toISOString(),
    secondsRemaining: Math.max(0, Math.floor((expiresMs - nowMs) / 1000)),
  };
}
