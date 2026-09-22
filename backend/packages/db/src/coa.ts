// Certificate of Authenticity.
//
// Two separate things live here:
//   1. The certificate NUMBER — assigned once, on moderation approval
//      (approveArtwork -> issueCertificate), immutable afterwards, and
//      shown publicly on the artwork/passport. Numbering is a per-year
//      counter doc: GZ-COA-2026-0001. Same counter pattern (and the same
//      documented not-perfectly-gapless caveat) as the product code in
//      artist-artworks.ts, but done INSIDE one transaction with the
//      artwork write so a number can't be consumed without landing on an
//      artwork.
//   2. Physical certificate REQUESTS — a buyer/artist asks for a signed
//      paper copy (artist MOU §12), the artist prints, signs and
//      dispatches it. physicalCoaStateMachine: requested -> dispatched.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { physicalCoaStateMachine } from "@galleryzone/domain";
import { Collections, type ArtworkDoc, type PhysicalCoaRequestDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class CoaError extends DbError {}
/** Thrown when the caller may not act on this artwork/request (controller maps to 404, never 403, to avoid confirming ids). */
export class CoaNotFoundError extends CoaError {}
/** Thrown for state conflicts (already requested, wrong status) — controller maps to 409. */
export class CoaConflictError extends CoaError {}

const COA_COUNTER_DOC = "coaCertificates";

/** Pure formatter, unit-tested in coa.check.ts. */
export function formatCertificateNumber(year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) throw new CoaError(`Bad certificate sequence ${sequence}`);
  return `GZ-COA-${year}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Assigns coaCertificateNumber + coaIssuedAt to an artwork if it doesn't
 * have one yet. Idempotent: a second call returns the existing number.
 * All reads before any write, per Firestore's transaction rule.
 */
export async function issueCertificate(db: Firestore, artworkId: string, now: Date = new Date()): Promise<{ certificateNumber: string; issued: boolean }> {
  const artworkRef = db.collection(Collections.artworks).doc(artworkId);
  const counterRef = db.collection("_counters").doc(COA_COUNTER_DOC);
  const year = now.getUTCFullYear();

  return db.runTransaction(async (tx) => {
    const [artworkSnap, counterSnap] = await Promise.all([tx.get(artworkRef), tx.get(counterRef)]);
    if (!artworkSnap.exists) throw new CoaNotFoundError(`No artwork ${artworkId}`);
    const artwork = artworkSnap.data() as ArtworkDoc;
    if (artwork.coaCertificateNumber) return { certificateNumber: artwork.coaCertificateNumber, issued: false };

    // One sequence per calendar year so numbers read as GZ-COA-<year>-<n>.
    const counters = (counterSnap.data() ?? {}) as Record<string, number>;
    const next = (counters[String(year)] ?? 0) + 1;
    const certificateNumber = formatCertificateNumber(year, next);

    tx.set(counterRef, { [String(year)]: next }, { merge: true });
    tx.update(artworkRef, { coaCertificateNumber: certificateNumber, coaIssuedAt: FieldValue.serverTimestamp() });
    return { certificateNumber, issued: true };
  });
}

// --- Physical certificate requests ------------------------------------------

export type PhysicalCoaRequest = PhysicalCoaRequestDoc & { id: string };

export interface CreatePhysicalCoaRequestInput {
  artworkId: string;
  requestedByUserId: string;
  delivery: { line1: string; city: string; state: string; pincode: string };
}

/** Anyone signed in may request one for an artwork that has a certificate; one open request per artwork at a time. */
export async function createPhysicalCoaRequest(db: Firestore, input: CreatePhysicalCoaRequestInput): Promise<PhysicalCoaRequest> {
  const artworkSnap = await db.collection(Collections.artworks).doc(input.artworkId).get();
  if (!artworkSnap.exists) throw new CoaNotFoundError(`No artwork ${input.artworkId}`);
  const artwork = artworkSnap.data() as ArtworkDoc;
  if (!artwork.coaCertificateNumber) {
    throw new CoaConflictError("This artwork has no certificate yet — one is issued when it is approved for listing");
  }

  const open = await db
    .collection(Collections.physicalCoaRequests)
    .where("artworkId", "==", input.artworkId)
    .where("status", "==", "requested")
    .limit(1)
    .get();
  if (!open.empty) throw new CoaConflictError("A physical certificate is already on its way for this artwork");

  const doc: PhysicalCoaRequestDoc = {
    artworkId: input.artworkId,
    requestedByUserId: input.requestedByUserId,
    requestedAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
    deliveryLine1: input.delivery.line1,
    deliveryCity: input.delivery.city,
    deliveryState: input.delivery.state,
    deliveryPincode: input.delivery.pincode,
    status: "requested",
    dispatchedAt: null,
    courierRef: null,
  };
  const ref = await db.collection(Collections.physicalCoaRequests).add(doc);
  const saved = await ref.get();
  return { id: ref.id, ...(saved.data() as PhysicalCoaRequestDoc) };
}

function byRequestedAtDesc(a: PhysicalCoaRequest, b: PhysicalCoaRequest): number {
  return (b.requestedAt?.toMillis() ?? 0) - (a.requestedAt?.toMillis() ?? 0);
}

/** Requests for one artwork. Visible to the requester, the artwork's artist, or an admin — the controller decides which. */
export async function listPhysicalCoaRequestsForArtwork(db: Firestore, artworkId: string): Promise<PhysicalCoaRequest[]> {
  const snap = await db.collection(Collections.physicalCoaRequests).where("artworkId", "==", artworkId).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as PhysicalCoaRequestDoc) })).sort(byRequestedAtDesc);
}

/** Every request across this artist's artworks — the dashboard queue. */
export async function listPhysicalCoaRequestsForArtist(db: Firestore, artistId: string): Promise<PhysicalCoaRequest[]> {
  const artworks = await db.collection(Collections.artworks).where("artistId", "==", artistId).select().get();
  const ids = artworks.docs.map((d) => d.id);
  if (ids.length === 0) return [];
  // Firestore caps `in` at 30 values per query.
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const snaps = await Promise.all(chunks.map((chunk) => db.collection(Collections.physicalCoaRequests).where("artworkId", "in", chunk).get()));
  return snaps
    .flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...(d.data() as PhysicalCoaRequestDoc) })))
    .sort(byRequestedAtDesc);
}

/** The artwork's artist marks the signed paper certificate as dispatched with a courier reference. */
export async function markPhysicalCoaDispatched(
  db: Firestore,
  { requestId, artistId, courierRef }: { requestId: string; artistId: string; courierRef: string },
): Promise<PhysicalCoaRequest> {
  if (!courierRef.trim()) throw new CoaConflictError("A courier reference is required");
  const ref = db.collection(Collections.physicalCoaRequests).doc(requestId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new CoaNotFoundError(`No request ${requestId}`);
    const request = snap.data() as PhysicalCoaRequestDoc;
    const artworkSnap = await tx.get(db.collection(Collections.artworks).doc(request.artworkId));
    if ((artworkSnap.data() as ArtworkDoc | undefined)?.artistId !== artistId) {
      throw new CoaNotFoundError(`No request ${requestId}`);
    }
    physicalCoaStateMachine.assertTransition(request.status, "dispatched");
    tx.update(ref, { status: "dispatched", dispatchedAt: FieldValue.serverTimestamp(), courierRef: courierRef.trim() });
  });

  const saved = await ref.get();
  return { id: ref.id, ...(saved.data() as PhysicalCoaRequestDoc) };
}
