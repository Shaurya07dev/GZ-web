// Admin settlements queue — Firestore version. settlements is a read model,
// not recomputed here — see the collections.ts header.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { settlementStateMachine } from "@galleryzone/domain";
import { Collections, artworkOwnershipEventsCol, type OwnershipEventDoc, type ProfileDoc, type SettlementDoc, type UserDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class SettlementError extends DbError {}

/**
 * Audit §5: admin needs to see artist/aggregator payout details inline on the
 * settlement so they can initiate the manual bank transfer without clicking
 * into another page. Everything comes from `users/{id}/profile` — the same
 * fields the recipient already filled in on their profile page.
 */
export interface PayoutMethodView {
  recipientName: string;
  /** Last 4 digits (full number never leaves the server). */
  bankAccountMasked: string | null;
  ifsc: string | null;
  /** Future field — artists haven't been asked for UPI yet. Null for now. */
  upiHandle: string | null;
}

export interface SettlementView {
  id: string;
  /** What this settlement pays for. Absent on legacy docs reads as "sale". */
  kind: "sale" | "artist_royalty";
  orderId: string | null;
  holdingId: string | null;
  /** For "artist_royalty" rows — points at the ownership event this came from. */
  transferId: string | null;
  artistId: string;
  artistName: string;
  artworkTitle: string;
  artistAmountPaise: number;
  aggregatorCommissionPaise: number | null;
  platformRevenuePaise: number;
  status: SettlementDoc["status"];
  releaseAfter: string;
  createdAt: string;
  processedAt: string | null;
  /** Payout destination — admin reads this to send the manual bank transfer. */
  payoutMethod: PayoutMethodView;
  /** For royalty rows: who paid the fee (the seller) + what the piece is
   *  changing hands at, so admin can audit the 2% against the 5% collected. */
  royaltyContext?: {
    sellerName: string;
    recipientName: string;
    givingPricePaise: number | null;
  };
}

async function royaltyContextOf(
  db: Firestore,
  transferIdValue: string | null,
): Promise<SettlementView["royaltyContext"] | undefined> {
  if (!transferIdValue) return undefined;
  const [artworkId, eventId] = transferIdValue.split(".");
  if (!artworkId || !eventId) return undefined;
  const snap = await db.collection(artworkOwnershipEventsCol(artworkId)).doc(eventId).get();
  if (!snap.exists) return undefined;
  const event = snap.data() as OwnershipEventDoc;
  return {
    sellerName: event.fromName,
    recipientName: event.toName,
    givingPricePaise: event.givingPricePaise ?? null,
  };
}

/** Every settlement, newest first, with the artist and artwork names joined. */
export async function listSettlements(db: Firestore): Promise<SettlementView[]> {
  const snap = await db.collection(Collections.settlements).get();
  const rows = await Promise.all(
    snap.docs.map(async (d) => {
      const s = d.data() as SettlementDoc;
      const kind: "sale" | "artist_royalty" = s.kind ?? "sale";
      const transferIdValue = s.transferId ?? null;
      const [artist, order, profile, royaltyContext] = await Promise.all([
        db.collection(Collections.users).doc(s.artistId).get(),
        s.orderId ? db.collection(Collections.orders).doc(s.orderId).get() : null,
        db.collection(`users/${s.artistId}/profile`).doc("data").get(),
        royaltyContextOf(db, transferIdValue),
      ]);
      // "sale": artwork title is read off the order. "artist_royalty": read
      // it off the transfer's artwork (there is no order for a royalty).
      let artworkTitle = "";
      const orderArtworkId = (order?.data() as { artworkId?: string } | undefined)?.artworkId;
      if (orderArtworkId) {
        const artwork = (await db.collection(Collections.artworks).doc(orderArtworkId).get()).data() as { title?: string } | undefined;
        artworkTitle = artwork?.title ?? "";
      } else if (transferIdValue) {
        const [artworkId] = transferIdValue.split(".");
        if (artworkId) {
          const artwork = (await db.collection(Collections.artworks).doc(artworkId).get()).data() as { title?: string } | undefined;
          artworkTitle = artwork?.title ?? "";
        }
      }
      const artistData = artist.data() as UserDoc | undefined;
      const profileData = profile.data() as ProfileDoc | undefined;
      return {
        id: d.id,
        kind,
        orderId: s.orderId,
        holdingId: s.holdingId,
        transferId: transferIdValue,
        artistId: s.artistId,
        artistName: artistData?.name ?? s.artistId,
        artworkTitle,
        artistAmountPaise: s.artistAmountPaise,
        aggregatorCommissionPaise: s.aggregatorCommissionPaise,
        platformRevenuePaise: s.platformRevenuePaise,
        status: s.status,
        releaseAfter: s.releaseAfter?.toDate().toISOString() ?? new Date(0).toISOString(),
        createdAt: s.createdAt?.toDate().toISOString() ?? new Date(0).toISOString(),
        processedAt: s.processedAt?.toDate().toISOString() ?? null,
        payoutMethod: {
          recipientName: profileData?.companyName?.trim() || artistData?.name || "Unknown",
          bankAccountMasked: profileData?.bankAccountMasked ?? null,
          ifsc: profileData?.ifsc ?? null,
          upiHandle: null,
        },
        ...(royaltyContext ? { royaltyContext } : {}),
      };
    }),
  );
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Admin marks a settlement paid by hand — used for artist royalty rows
 * (the 2% owed on a resale) and for any other settlement the ops team
 * has wire-transferred out of band. Only legal from `pending`; stamps
 * `processedAt` so the queue hides it.
 */
export async function markSettlementProcessed(db: Firestore, settlementId: string): Promise<void> {
  const ref = db.collection(Collections.settlements).doc(settlementId);
  const snap = await ref.get();
  if (!snap.exists) throw new SettlementError(`No settlement ${settlementId}`);
  const settlement = snap.data() as SettlementDoc;
  settlementStateMachine.assertTransition(settlement.status, "processed");
  await ref.update({ status: "processed", processedAt: FieldValue.serverTimestamp() });
}

/** Only legal from "failed" — matches the mock's own retrySettlement rule. */
export async function retrySettlement(db: Firestore, settlementId: string): Promise<void> {
  const ref = db.collection(Collections.settlements).doc(settlementId);
  const snap = await ref.get();
  if (!snap.exists) throw new SettlementError(`No settlement ${settlementId}`);
  const settlement = snap.data() as SettlementDoc;
  settlementStateMachine.assertTransition(settlement.status, "pending");
  await ref.update({ status: "pending" });
}
