// Admin settlements queue — Firestore version. settlements is a read model,
// not recomputed here — see the collections.ts header.

import type { Firestore } from "firebase-admin/firestore";
import { settlementStateMachine } from "@galleryzone/domain";
import { Collections, type SettlementDoc } from "./collections.ts";

export class SettlementError extends Error {}

export async function listSettlements(db: Firestore): Promise<(SettlementDoc & { id: string })[]> {
  const snap = await db.collection(Collections.settlements).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as SettlementDoc) }));
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
