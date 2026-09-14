// Legal ownership of an artwork, as an event log (plan.md §3.2: "append-only
// ownership_events; current owner is a projection, never a mutable column").
//
// Two ways ownership moves:
//   1. A SALE — confirmSimulatedPayment (checkout.ts) calls
//      recordSaleTransfer() the moment the order is paid (the user's
//      decision: title passes on payment, not on delivery). Written
//      already-accepted, keyed on orderId so a replayed webhook can't
//      double-transfer.
//   2. A MANUAL hand-over — the current owner invites someone (by email);
//      the recipient accepts from /transfer/{id}. transferStateMachine:
//      pending -> accepted | cancelled. `display` kind lends the piece for
//      a period without moving title.
//
// Nothing here reads or exposes emails except to the two parties involved
// — the public passport (verify.ts) gets name snapshots only.

import { FieldValue, Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import { transferStateMachine, type TransferStatus } from "@galleryzone/domain";
import { Collections, artworkOwnershipEventsCol, type ArtworkDoc, type OwnershipEventDoc, type UserDoc } from "./collections.ts";

export class OwnershipError extends Error {}
export class OwnershipNotFoundError extends OwnershipError {}
export class OwnershipConflictError extends OwnershipError {}

export type OwnershipEvent = OwnershipEventDoc & { id: string; artworkId: string };

export interface CurrentOwner {
  userId: string;
  /** "artist" until the first accepted ownership transfer, "collector" after. */
  kind: "artist" | "collector";
  displayName: string;
}

const serverNow = () => FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp;

async function userName(db: Firestore, uid: string | null): Promise<string> {
  if (!uid) return "Unknown";
  const snap = await db.collection(Collections.users).doc(uid).get();
  return (snap.data() as UserDoc | undefined)?.name ?? "Unknown";
}

/** All events for an artwork, oldest first. */
export async function listOwnershipEvents(db: Firestore, artworkId: string): Promise<OwnershipEvent[]> {
  const snap = await db.collection(artworkOwnershipEventsCol(artworkId)).orderBy("initiatedAt", "asc").get();
  return snap.docs.map((d) => ({ id: transferId(artworkId, d.id), artworkId, ...(d.data() as OwnershipEventDoc) }));
}

/** Latest accepted `ownership` event's recipient, else the artist. */
export async function getCurrentOwner(db: Firestore, artworkId: string): Promise<CurrentOwner> {
  const artworkSnap = await db.collection(Collections.artworks).doc(artworkId).get();
  if (!artworkSnap.exists) throw new OwnershipNotFoundError(`No artwork ${artworkId}`);
  const artwork = artworkSnap.data() as ArtworkDoc;

  const events = await listOwnershipEvents(db, artworkId);
  const last = [...events].reverse().find((e) => e.kind === "ownership" && e.status === "accepted" && e.toUserId);
  if (last?.toUserId) return { userId: last.toUserId, kind: "collector", displayName: last.toName };
  return { userId: artwork.artistId, kind: "artist", displayName: await userName(db, artwork.artistId) };
}

/**
 * Sale hook. Idempotent on orderId. Transfers from whoever currently owns
 * the piece (the artist for a first sale; a collector for a resale) to the
 * buyer, already accepted — a paid order IS the acceptance.
 */
export async function recordSaleTransfer(
  db: Firestore,
  { artworkId, orderId, buyerId }: { artworkId: string; orderId: string; buyerId: string },
): Promise<{ eventId: string; created: boolean }> {
  const existing = await db.collection(artworkOwnershipEventsCol(artworkId)).where("orderId", "==", orderId).limit(1).get();
  if (!existing.empty) return { eventId: existing.docs[0]!.id, created: false };

  const [owner, buyerName] = await Promise.all([getCurrentOwner(db, artworkId), userName(db, buyerId)]);
  const doc: OwnershipEventDoc = {
    kind: "ownership",
    status: "accepted",
    fromUserId: owner.userId,
    toUserId: buyerId,
    toEmail: null,
    fromName: owner.displayName,
    toName: buyerName,
    orderId,
    initiatedAt: serverNow(),
    acceptedAt: serverNow(),
    cancelledAt: null,
    displayEndsAt: null,
    displayEndedAt: null,
  };
  const ref = await db.collection(artworkOwnershipEventsCol(artworkId)).add(doc);
  return { eventId: transferId(artworkId, ref.id), created: true };
}

// --- Manual transfers -----------------------------------------------------------

export interface InitiateTransferInput {
  artworkId: string;
  byUserId: string;
  kind: "ownership" | "display";
  toName: string;
  toEmail: string;
  /** Display transfers only. */
  displayEndsAt?: Date | undefined;
}

/** Only the current owner may hand a piece over; one open transfer per artwork at a time. */
export async function initiateTransfer(db: Firestore, input: InitiateTransferInput): Promise<OwnershipEvent> {
  const owner = await getCurrentOwner(db, input.artworkId);
  if (owner.userId !== input.byUserId) throw new OwnershipNotFoundError(`No artwork ${input.artworkId}`);

  const events = await listOwnershipEvents(db, input.artworkId);
  if (events.some((e) => e.status === "pending")) throw new OwnershipConflictError("A transfer is already pending for this artwork");
  if (input.kind === "ownership" && events.some((e) => e.kind === "display" && e.status === "accepted" && !e.displayEndedAt)) {
    throw new OwnershipConflictError("End the current display period before transferring ownership");
  }
  if (input.kind === "display") {
    if (!input.displayEndsAt || input.displayEndsAt.getTime() <= Date.now()) {
      throw new OwnershipConflictError("A display transfer needs an end date in the future");
    }
    if (events.some((e) => e.kind === "display" && e.status === "accepted" && !e.displayEndedAt)) {
      throw new OwnershipConflictError("This artwork is already on display elsewhere");
    }
  }

  const doc: OwnershipEventDoc = {
    kind: input.kind,
    status: "pending",
    fromUserId: owner.userId,
    toUserId: null,
    toEmail: input.toEmail.trim().toLowerCase(),
    fromName: owner.displayName,
    toName: input.toName.trim(),
    orderId: null,
    initiatedAt: serverNow(),
    acceptedAt: null,
    cancelledAt: null,
    displayEndsAt: input.displayEndsAt ? Timestamp.fromDate(input.displayEndsAt) : null,
    displayEndedAt: null,
  };
  const ref = await db.collection(artworkOwnershipEventsCol(input.artworkId)).add(doc);
  const saved = await ref.get();
  return { id: transferId(input.artworkId, ref.id), artworkId: input.artworkId, ...(saved.data() as OwnershipEventDoc) };
}

/**
 * Public transfer ids are `<artworkId>.<eventId>` — events live under
 * artworks/{id}/ownershipEvents, so carrying the parent in the id means a
 * lookup is one document read, no collection-group index needed.
 */
export function transferId(artworkId: string, eventId: string): string {
  return `${artworkId}.${eventId}`;
}

function parseTransferId(id: string): { artworkId: string; eventId: string } | null {
  const [artworkId, eventId, ...rest] = id.split(".");
  return artworkId && eventId && rest.length === 0 ? { artworkId, eventId } : null;
}

export async function getTransfer(db: Firestore, id: string): Promise<OwnershipEvent | null> {
  const parsed = parseTransferId(id);
  if (!parsed) return null;
  const snap = await db.collection(artworkOwnershipEventsCol(parsed.artworkId)).doc(parsed.eventId).get();
  if (!snap.exists) return null;
  return { id, artworkId: parsed.artworkId, ...(snap.data() as OwnershipEventDoc) };
}

async function settle(
  db: Firestore,
  transferId: string,
  to: TransferStatus,
  check: (event: OwnershipEvent, tx: Transaction) => Promise<Partial<OwnershipEventDoc>>,
): Promise<OwnershipEvent> {
  const found = await getTransfer(db, transferId);
  if (!found) throw new OwnershipNotFoundError(`No transfer ${transferId}`);
  const ref = db.collection(artworkOwnershipEventsCol(found.artworkId)).doc(parseTransferId(transferId)!.eventId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const event = { id: transferId, artworkId: found.artworkId, ...(snap.data() as OwnershipEventDoc) };
    const extra = await check(event, tx);
    transferStateMachine.assertTransition(event.status, to);
    tx.update(ref, { status: to, ...extra });
  });

  const saved = await ref.get();
  return { id: transferId, artworkId: found.artworkId, ...(saved.data() as OwnershipEventDoc) };
}

/** The invited recipient accepts. Matched on the signed-in account's email (the invite was sent to an address, not a uid). */
export async function acceptTransfer(db: Firestore, { transferId, byUserId }: { transferId: string; byUserId: string }): Promise<OwnershipEvent> {
  const userSnap = await db.collection(Collections.users).doc(byUserId).get();
  const user = userSnap.data() as UserDoc | undefined;
  if (!user) throw new OwnershipNotFoundError(`No user ${byUserId}`);

  return settle(db, transferId, "accepted", async (event) => {
    if (event.toEmail !== user.email.toLowerCase()) throw new OwnershipNotFoundError(`No transfer ${transferId}`);
    if (event.fromUserId === byUserId) throw new OwnershipConflictError("You can't accept your own transfer");
    return { toUserId: byUserId, toName: user.name, acceptedAt: serverNow() };
  });
}

/** Either party may cancel while pending. */
export async function cancelTransfer(db: Firestore, { transferId, byUserId }: { transferId: string; byUserId: string }): Promise<OwnershipEvent> {
  const userSnap = await db.collection(Collections.users).doc(byUserId).get();
  const email = (userSnap.data() as UserDoc | undefined)?.email.toLowerCase();
  return settle(db, transferId, "cancelled", async (event) => {
    if (event.fromUserId !== byUserId && event.toEmail !== email) throw new OwnershipNotFoundError(`No transfer ${transferId}`);
    return { cancelledAt: serverNow() };
  });
}

/** The owner ends an accepted display period early. Not a state-machine move — the event stays `accepted`, with displayEndedAt set. */
export async function endDisplay(db: Firestore, { transferId, byUserId }: { transferId: string; byUserId: string }): Promise<OwnershipEvent> {
  const found = await getTransfer(db, transferId);
  if (!found || found.fromUserId !== byUserId) throw new OwnershipNotFoundError(`No transfer ${transferId}`);
  if (found.kind !== "display" || found.status !== "accepted") throw new OwnershipConflictError("Only an active display period can be ended");
  if (found.displayEndedAt) return found;
  const ref = db.collection(artworkOwnershipEventsCol(found.artworkId)).doc(parseTransferId(transferId)!.eventId);
  await ref.update({ displayEndedAt: serverNow() });
  const saved = await ref.get();
  return { id: transferId, artworkId: found.artworkId, ...(saved.data() as OwnershipEventDoc) };
}
