// Admin settlements queue — Firestore version. settlements is a read model,
// not recomputed here — see the collections.ts header.

import type { Firestore } from "firebase-admin/firestore";
import { settlementStateMachine } from "@galleryzone/domain";
import { Collections, type SettlementDoc } from "./collections.ts";

export class SettlementError extends Error {}

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
}

/** Every settlement, newest first, with the artist and artwork names joined. */
export async function listSettlements(db: Firestore): Promise<SettlementView[]> {
  const snap = await db.collection(Collections.settlements).get();
  const rows = await Promise.all(
    snap.docs.map(async (d) => {
      const s = d.data() as SettlementDoc;
      const [artist, order] = await Promise.all([
        db.collection(Collections.users).doc(s.artistId).get(),
        s.orderId ? db.collection(Collections.orders).doc(s.orderId).get() : null,
      ]);
      const artworkId = (order?.data() as { artworkId?: string } | undefined)?.artworkId;
      const artwork = artworkId ? ((await db.collection(Collections.artworks).doc(artworkId).get()).data() as { title?: string } | undefined) : undefined;
      return {
        id: d.id,
        orderId: s.orderId,
        holdingId: s.holdingId,
        artistId: s.artistId,
        artistName: (artist.data() as { name?: string } | undefined)?.name ?? s.artistId,
        artworkTitle: artwork?.title ?? "",
        artistAmountPaise: s.artistAmountPaise,
        aggregatorCommissionPaise: s.aggregatorCommissionPaise,
        platformRevenuePaise: s.platformRevenuePaise,
        status: s.status,
        releaseAfter: s.releaseAfter?.toDate().toISOString() ?? new Date(0).toISOString(),
        createdAt: s.createdAt?.toDate().toISOString() ?? new Date(0).toISOString(),
        processedAt: s.processedAt?.toDate().toISOString() ?? null,
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
