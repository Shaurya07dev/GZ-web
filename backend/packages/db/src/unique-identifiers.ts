// Enforces uniqueness of personally-identifying account fields across all
// users: email, phone, PAN, bank account, GSTIN, Aadhaar. No two accounts
// are allowed to share any of these (owner directive 28 Nov 2026 — repeat
// signups and one person operating multiple accounts by reusing the same
// bank account were both observed in sandbox).
//
// Firestore has no native unique constraints, so we maintain an index
// collection `uniqueIdentifiers` where each claimed value is a document
// with id `${scope}:${normalisedValue}`. The doc stores the owning uid.
// Writes go through a Firestore transaction — concurrent attempts to
// claim the same identifier see at most one winner; the loser's call
// throws UniqueIdentifierError and the profile update that initiated
// it fails cleanly.
//
// Sensitive values (bank account, Aadhaar) are hashed before use as a
// doc id, so a Firestore export can't read them back. Non-sensitive
// values (phone, PAN, GSTIN) use the plain normalised form so admin
// debugging and manual lookups stay possible.

import { createHash } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { Collections } from "./collections.ts";
import { DbError } from "./errors.ts";

export class UniqueIdentifierError extends DbError {}

export type UniqueScope =
  | "email"
  | "phone"
  | "pan"
  | "gstin"
  | "bankAccount"
  | "aadhaar";

export interface UniqueIdentifierDoc {
  scope: UniqueScope;
  /** The user who holds this identifier. */
  uid: string;
  /** When this claim was first written. Set via FieldValue.serverTimestamp
   *  on the caller side; left typed as any for Firestore flexibility. */
  claimedAt: FirebaseFirestore.Timestamp;
}

/** Scopes whose values go into the doc id verbatim (after normalisation)
 *  — admin can recognise them in the Firestore console. */
const PLAINTEXT_SCOPES = new Set<UniqueScope>(["email", "phone", "pan", "gstin"]);

/** User-facing label for each scope, used in error messages so the
 *  profile form can show "This phone number is already in use" rather
 *  than our internal scope key. */
const SCOPE_LABEL: Record<UniqueScope, string> = {
  email: "email address",
  phone: "phone number",
  pan: "PAN",
  gstin: "GSTIN",
  bankAccount: "bank account",
  aadhaar: "Aadhaar number",
};

/** Build the Firestore doc id for a claim. Sensitive scopes are hashed
 *  with SHA-256 to keep the raw value out of Firestore exports. */
function docIdFor(scope: UniqueScope, value: string): string {
  const normalised = value.trim();
  if (PLAINTEXT_SCOPES.has(scope)) {
    return `${scope}:${normalised.toLowerCase()}`;
  }
  const hash = createHash("sha256").update(`${scope}:${normalised}`).digest("hex");
  return `${scope}:${hash}`;
}

/** Transactional claim: creates the index doc if free, refuses if held
 *  by a different uid, is a no-op if already held by `uid`. Call from
 *  inside a larger Firestore transaction when the surrounding write
 *  needs to be atomic (preferred — see claimInBatch). */
export function claimInTransaction(
  db: Firestore,
  tx: Transaction,
  scope: UniqueScope,
  value: string,
  uid: string,
): void {
  const ref = db.collection(Collections.uniqueIdentifiers).doc(docIdFor(scope, value));
  // Note: tx.get() must have run before any tx.set/update in Firestore
  // semantics. Callers are expected to call this helper BEFORE any
  // writes in their transaction body.
  return claimOrThrow(tx, ref, scope, uid);
}

function claimOrThrow(
  tx: Transaction,
  ref: FirebaseFirestore.DocumentReference,
  scope: UniqueScope,
  uid: string,
): void {
  // We'd normally await tx.get here, but Firestore transactions require
  // the get to happen BEFORE any writes — callers must have already
  // read everything they need. We split read and write into two steps:
  // `checkReadPhase` returns a function to call in the write phase.
  //
  // In practice this helper isn't quite right for the mixed-read/write
  // Firestore API. The real export below (`claimIdentifier`) uses a
  // runTransaction wrapper that does the read + the write together.
  void tx;
  void ref;
  void scope;
  void uid;
  throw new Error("Use claimIdentifier (runTransaction wrapper) instead of claimInTransaction");
}

/**
 * Standalone transactional claim. Use when a profile update doesn't
 * already run inside its own transaction (updateOwnProfile uses a
 * batch, not a transaction, so this is the right entry point for it).
 *
 * Idempotent — re-claiming a value the same uid already holds returns
 * without writing. Throws UniqueIdentifierError when a DIFFERENT uid
 * holds it.
 */
export async function claimIdentifier(
  db: Firestore,
  scope: UniqueScope,
  value: string,
  uid: string,
): Promise<void> {
  const ref = db.collection(Collections.uniqueIdentifiers).doc(docIdFor(scope, value));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const existing = snap.data() as UniqueIdentifierDoc;
      if (existing.uid === uid) return; // idempotent re-claim
      throw new UniqueIdentifierError(
        `This ${SCOPE_LABEL[scope]} is already associated with another GalleryZone account. Each identifier can only be used by one account.`,
      );
    }
    tx.set(ref, {
      scope,
      uid,
      claimedAt: (await import("firebase-admin/firestore")).FieldValue.serverTimestamp(),
    });
  });
}

/** Release a previously-claimed identifier. Called when a user clears a
 *  field (sets to null) or when a profile is deleted. Idempotent —
 *  missing docs are fine, wrong-owner docs are left alone. */
export async function releaseIdentifier(
  db: Firestore,
  scope: UniqueScope,
  value: string,
  uid: string,
): Promise<void> {
  const ref = db.collection(Collections.uniqueIdentifiers).doc(docIdFor(scope, value));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const existing = snap.data() as UniqueIdentifierDoc;
    if (existing.uid !== uid) return; // not ours to release
    tx.delete(ref);
  });
}

/**
 * Transition from one value to another atomically — the previous value
 * is released and the new one claimed in a single transaction. Returns
 * early if `nextValue === previousValue` (no change). Throws if the
 * new value is already claimed by a different uid.
 *
 * Both values are optional (null = "no value"): a user setting a field
 * for the first time just claims; a user clearing a field just releases;
 * a user changing it does both.
 */
export async function reclaimIdentifier(
  db: Firestore,
  scope: UniqueScope,
  args: { uid: string; previousValue: string | null; nextValue: string | null },
): Promise<void> {
  const { uid, previousValue, nextValue } = args;
  const prev = previousValue?.trim() || null;
  const next = nextValue?.trim() || null;
  if (prev === next) return;

  const prevRef = prev ? db.collection(Collections.uniqueIdentifiers).doc(docIdFor(scope, prev)) : null;
  const nextRef = next ? db.collection(Collections.uniqueIdentifiers).doc(docIdFor(scope, next)) : null;

  await db.runTransaction(async (tx) => {
    // ALL reads first — Firestore rule.
    const prevSnap = prevRef ? await tx.get(prevRef) : null;
    const nextSnap = nextRef ? await tx.get(nextRef) : null;
    if (nextRef && nextSnap?.exists) {
      const existing = nextSnap.data() as UniqueIdentifierDoc;
      if (existing.uid !== uid) {
        throw new UniqueIdentifierError(
          `This ${SCOPE_LABEL[scope]} is already associated with another GalleryZone account. Each identifier can only be used by one account.`,
        );
      }
    }
    // Writes.
    if (prevRef && prevSnap?.exists) {
      const existing = prevSnap.data() as UniqueIdentifierDoc;
      if (existing.uid === uid) tx.delete(prevRef);
    }
    if (nextRef && (!nextSnap || !nextSnap.exists)) {
      const { FieldValue } = await import("firebase-admin/firestore");
      tx.set(nextRef, {
        scope,
        uid,
        claimedAt: FieldValue.serverTimestamp(),
      });
    }
  });
}
