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
import { Collections, artworkOwnershipEventsCol, type ArtworkDoc, type OwnershipEventDoc, type SettlementDoc, type UserDoc } from "./collections.ts";
import { DbError } from "./errors.ts";
import { latestStatusOf } from "./listing-projection.ts";

export class OwnershipError extends DbError {}
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
    displayStartsAt: null,
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
  /** Display transfers only: open date. Defaults to the acceptance moment
   *  when omitted, which keeps older call sites working. */
  displayStartsAt?: Date | undefined;
  /** Display transfers only. */
  displayEndsAt?: Date | undefined;
  /** Ownership kind only: what the piece is changing hands at, in paise.
   *  Drives the 5% platform fee (2% artist royalty + 3% platform net).
   *  Required when kind is "ownership"; ignored for display. */
  givingPricePaise?: number | undefined;
}

/** 2% + 3% = 5% of giving price; +18% GST on the fee. Everything paise. */
export interface TransferFeeSplit {
  royaltyPaise: number;
  platformFeeNetPaise: number;
  feeGstPaise: number;
  feeTotalPaise: number;
}

const ROYALTY_RATE = 0.02;
const PLATFORM_RATE = 0.03;
const GST_RATE = 0.18;

export function computeTransferFee(givingPricePaise: number): TransferFeeSplit {
  const royalty = Math.round(givingPricePaise * ROYALTY_RATE);
  const platformNet = Math.round(givingPricePaise * PLATFORM_RATE);
  const feeNet = royalty + platformNet;
  const gst = Math.round(feeNet * GST_RATE);
  return {
    royaltyPaise: royalty,
    platformFeeNetPaise: platformNet,
    feeGstPaise: gst,
    feeTotalPaise: feeNet + gst,
  };
}

const ON_SALE = new Set(["marketplace", "reserved", "with_aggregator"]);

/** Only the current owner may hand a piece over; one open transfer per artwork at a time. */
export async function initiateTransfer(db: Firestore, input: InitiateTransferInput): Promise<OwnershipEvent> {
  const owner = await getCurrentOwner(db, input.artworkId);
  if (owner.userId !== input.byUserId) throw new OwnershipNotFoundError(`No artwork ${input.artworkId}`);

  // A piece that is for sale or with a gallery can't change hands privately: the sale that follows
  // would take title from the new owner while paying the old one.
  if (input.kind === "ownership" && ON_SALE.has(await latestStatusOf(db, input.artworkId))) {
    throw new OwnershipConflictError("Take the artwork off sale (and back from any gallery) before transferring ownership");
  }

  const events = await listOwnershipEvents(db, input.artworkId);
  if (events.some((e) => e.status === "pending" || e.status === "awaiting_payment")) {
    throw new OwnershipConflictError("A transfer is already in progress for this artwork");
  }
  if (input.kind === "ownership" && events.some((e) => e.kind === "display" && e.status === "accepted" && !e.displayEndedAt)) {
    throw new OwnershipConflictError("End the current display period before transferring ownership");
  }

  // Ownership transfers need a real giving price (drives the 5% fee) and
  // the invitee must already have a GalleryZone account on that email —
  // the owner pays the fee on confirmation, so finding out at that point
  // that the recipient never signed up would strand the money.
  let feeSplit: TransferFeeSplit | null = null;
  if (input.kind === "ownership") {
    if (!Number.isInteger(input.givingPricePaise) || (input.givingPricePaise ?? 0) <= 0) {
      throw new OwnershipConflictError("Enter the price this piece is changing hands at");
    }
    feeSplit = computeTransferFee(input.givingPricePaise!);

    const inviteeEmail = input.toEmail.trim().toLowerCase();
    const existing = await db.collection(Collections.users).where("email", "==", inviteeEmail).limit(1).get();
    if (existing.empty) {
      throw new OwnershipConflictError("That email isn't on GalleryZone yet — ask them to sign up, then try again");
    }
  }

  if (input.kind === "display") {
    if (!input.displayEndsAt || input.displayEndsAt.getTime() <= Date.now()) {
      throw new OwnershipConflictError("A display transfer needs an end date in the future");
    }
    if (input.displayStartsAt && input.displayEndsAt.getTime() <= input.displayStartsAt.getTime()) {
      throw new OwnershipConflictError("The display end date must come after the start date");
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
    displayStartsAt: input.displayStartsAt ? Timestamp.fromDate(input.displayStartsAt) : null,
    displayEndsAt: input.displayEndsAt ? Timestamp.fromDate(input.displayEndsAt) : null,
    displayEndedAt: null,
    givingPricePaise: input.kind === "ownership" ? input.givingPricePaise! : null,
    royaltyPaise: feeSplit?.royaltyPaise ?? null,
    platformFeeNetPaise: feeSplit?.platformFeeNetPaise ?? null,
    feeGstPaise: feeSplit?.feeGstPaise ?? null,
    feeTotalPaise: feeSplit?.feeTotalPaise ?? null,
    feeProviderOrderId: null,
    feeProviderPaymentId: null,
    feePaidAt: null,
    royaltySettlementId: null,
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

/**
 * The invited recipient confirms. Matched on the signed-in account's email
 * (the invite was sent to an address, not a uid).
 *
 * For an ownership kind with a giving price (= the resale royalty path),
 * this transitions to `awaiting_payment` rather than `accepted` — title
 * doesn't pass until the sender pays the 5% fee. `display` kinds and
 * price-less ownership events (sale-triggered or legacy) go straight to
 * `accepted` as before.
 */
export async function acceptTransfer(db: Firestore, { transferId, byUserId }: { transferId: string; byUserId: string }): Promise<OwnershipEvent> {
  const userSnap = await db.collection(Collections.users).doc(byUserId).get();
  const user = userSnap.data() as UserDoc | undefined;
  if (!user) throw new OwnershipNotFoundError(`No user ${byUserId}`);

  const found = await getTransfer(db, transferId);
  if (!found) throw new OwnershipNotFoundError(`No transfer ${transferId}`);
  const target: TransferStatus =
    found.kind === "ownership" && (found.givingPricePaise ?? 0) > 0 ? "awaiting_payment" : "accepted";

  return settle(db, transferId, target, async (event) => {
    if (event.toEmail !== user.email.toLowerCase()) throw new OwnershipNotFoundError(`No transfer ${transferId}`);
    if (event.fromUserId === byUserId) throw new OwnershipConflictError("You can't accept your own transfer");
    return target === "accepted"
      ? { toUserId: byUserId, toName: user.name, acceptedAt: serverNow() }
      : { toUserId: byUserId, toName: user.name };
  });
}

/**
 * Stamp the Razorpay order id on the transfer so the webhook has a path
 * back to it. Called the moment the controller creates the gateway order.
 */
export async function attachTransferFeeProviderOrder(
  db: Firestore,
  transferIdValue: string,
  providerOrderId: string,
): Promise<void> {
  const parsed = parseTransferId(transferIdValue);
  if (!parsed) throw new OwnershipNotFoundError(`No transfer ${transferIdValue}`);
  const ref = db.collection(artworkOwnershipEventsCol(parsed.artworkId)).doc(parsed.eventId);
  await ref.update({ feeProviderOrderId: providerOrderId });
}

/** Reverse lookup for the Razorpay webhook. */
export async function transferIdForProviderOrder(
  db: Firestore,
  providerOrderId: string,
): Promise<string | null> {
  const snap = await db.collectionGroup("ownershipEvents").where("feeProviderOrderId", "==", providerOrderId).limit(1).get();
  const doc = snap.docs[0];
  const artworkId = doc?.ref.parent.parent?.id;
  if (!doc || !artworkId) return null;
  return transferId(artworkId, doc.id);
}

/**
 * The sender has paid the 5% fee. Finalise the ownership transfer AND
 * write the artist-royalty settlement (admin pays it out manually, same
 * pattern as aggregator commissions).
 *
 * Idempotent on the pair (transferId, providerPaymentId): a webhook that
 * fires twice does nothing the second time. If the transfer is already
 * accepted (verify beat the webhook) this is a no-op.
 */
export async function markTransferFeePaid(
  db: Firestore,
  input: {
    transferId: string;
    providerPaymentId: string;
    reportedAmountPaise?: number | null;
  },
): Promise<{ eventId: string; settlementId: string | null; artistId: string | null }> {
  const parsed = parseTransferId(input.transferId);
  if (!parsed) throw new OwnershipNotFoundError(`No transfer ${input.transferId}`);
  const eventRef = db.collection(artworkOwnershipEventsCol(parsed.artworkId)).doc(parsed.eventId);

  // The artist that collects the royalty is the ORIGINAL artist, read once
  // outside the transaction. The settlement doc writes a snapshot.
  const artworkSnap = await db.collection(Collections.artworks).doc(parsed.artworkId).get();
  if (!artworkSnap.exists) throw new OwnershipNotFoundError(`No artwork ${parsed.artworkId}`);
  const artwork = artworkSnap.data() as ArtworkDoc;
  const artistId = artwork.artistId;

  const settlementRef = db.collection(Collections.settlements).doc();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(eventRef);
    if (!snap.exists) throw new OwnershipNotFoundError(`No transfer ${input.transferId}`);
    const event = snap.data() as OwnershipEventDoc;

    // Replay guard — same paymentId already recorded: no-op.
    if (event.feeProviderPaymentId === input.providerPaymentId && event.status === "accepted") {
      return { settlementId: event.royaltySettlementId ?? null, artistId, created: false };
    }
    if (event.status !== "awaiting_payment") {
      // Either a late webhook (already accepted) or a cancelled transfer.
      return { settlementId: event.royaltySettlementId ?? null, artistId, created: false };
    }

    if (
      typeof input.reportedAmountPaise === "number" &&
      event.feeTotalPaise != null &&
      input.reportedAmountPaise !== event.feeTotalPaise
    ) {
      throw new OwnershipConflictError(
        `Paid amount ${input.reportedAmountPaise} does not match transfer fee ${event.feeTotalPaise}`,
      );
    }

    const royaltyPaise = event.royaltyPaise ?? 0;
    const platformNetPaise = event.platformFeeNetPaise ?? 0;
    const feeGstPaise = event.feeGstPaise ?? 0;

    // Settlement row for the artist's 2% royalty. Platform revenue on this
    // row is the 3% platform retention + the full GST collected (which is
    // remitted, not paid out to anyone). orderId / holdingId are null —
    // transferId points back to where this settlement came from.
    const settlementDoc: SettlementDoc = {
      orderId: null,
      holdingId: null,
      artistId,
      artistAmountPaise: royaltyPaise,
      aggregatorCommissionPaise: null,
      platformRevenuePaise: platformNetPaise + feeGstPaise,
      status: "pending",
      releaseAfter: serverNow(),
      createdAt: serverNow(),
      processedAt: null,
      kind: "artist_royalty",
      transferId: input.transferId,
    };

    transferStateMachine.assertTransition(event.status, "accepted");
    tx.update(eventRef, {
      status: "accepted",
      acceptedAt: serverNow(),
      feeProviderPaymentId: input.providerPaymentId,
      feePaidAt: serverNow(),
      royaltySettlementId: settlementRef.id,
    });
    tx.set(settlementRef, settlementDoc);

    return { settlementId: settlementRef.id, artistId, created: true };
  });

  return { eventId: input.transferId, settlementId: result.settlementId, artistId };
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

/** Everything this user currently owns: accepted ownership events addressed to them, minus pieces they have since passed on. */
export interface CollectionEntry {
  artworkId: string;
  acquiredAt: Date;
  orderId: string | null;
  fromName: string;
  source: "marketplace_order" | "transfer";
}

export async function listCollection(db: Firestore, userId: string): Promise<CollectionEntry[]> {
  const snap = await db.collectionGroup("ownershipEvents").where("toUserId", "==", userId).where("status", "==", "accepted").get();
  const entries: CollectionEntry[] = [];
  for (const d of snap.docs) {
    const e = d.data() as OwnershipEventDoc;
    if (e.kind !== "ownership") continue;
    const artworkId = d.ref.parent.parent?.id;
    if (!artworkId) continue;
    // Still the owner only if no later accepted ownership event moved it on.
    const owner = await getCurrentOwner(db, artworkId).catch(() => null);
    if (owner?.userId !== userId) continue;
    entries.push({
      artworkId,
      acquiredAt: e.acceptedAt?.toDate() ?? e.initiatedAt?.toDate() ?? new Date(0),
      orderId: e.orderId,
      fromName: e.fromName,
      source: e.orderId ? "marketplace_order" : "transfer",
    });
  }
  const seen = new Set<string>();
  return entries
    .sort((a, b) => b.acquiredAt.getTime() - a.acquiredAt.getTime())
    .filter((e) => (seen.has(e.artworkId) ? false : (seen.add(e.artworkId), true)));
}
