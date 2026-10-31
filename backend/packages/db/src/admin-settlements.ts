// Admin settlements queue — Firestore version. settlements is a read model,
// not recomputed here — see the collections.ts header.

import type { Firestore } from "firebase-admin/firestore";
import { settlementStateMachine } from "@galleryzone/domain";
import { Collections, type ProfileDoc, type SettlementDoc, type UserDoc } from "./collections.ts";
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
  orderId: string | null;
  holdingId: string | null;
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
}

/** Every settlement, newest first, with the artist and artwork names joined. */
export async function listSettlements(db: Firestore): Promise<SettlementView[]> {
  const snap = await db.collection(Collections.settlements).get();
  const rows = await Promise.all(
    snap.docs.map(async (d) => {
      const s = d.data() as SettlementDoc;
      const [artist, order, profile] = await Promise.all([
        db.collection(Collections.users).doc(s.artistId).get(),
        s.orderId ? db.collection(Collections.orders).doc(s.orderId).get() : null,
        db.collection(`users/${s.artistId}/profile`).doc("data").get(),
      ]);
      const artworkId = (order?.data() as { artworkId?: string } | undefined)?.artworkId;
      const artwork = artworkId ? ((await db.collection(Collections.artworks).doc(artworkId).get()).data() as { title?: string } | undefined) : undefined;
      const artistData = artist.data() as UserDoc | undefined;
      const profileData = profile.data() as ProfileDoc | undefined;
      return {
        id: d.id,
        orderId: s.orderId,
        holdingId: s.holdingId,
        artistId: s.artistId,
        artistName: artistData?.name ?? s.artistId,
        artworkTitle: artwork?.title ?? "",
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
      };
    }),
  );
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
