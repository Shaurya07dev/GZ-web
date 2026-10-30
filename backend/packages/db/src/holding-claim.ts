// A reserved holding leaves exactly one way: sold, or returned. Both paths
// used to check the status outside any transaction and then post under
// different idempotency keys, so a sale and a return sent together could both
// pass and give the aggregator's hold back twice. Claiming the way out in a
// transaction first makes the second one fail. Claiming the SAME way again is
// allowed, so a retry of a half-finished sale or return can still complete.

import type { Firestore } from "firebase-admin/firestore";
import { Collections, type AggregatorHoldingDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class HoldingClaimError extends DbError {}

export async function claimHoldingExit(db: Firestore, holdingId: string, exit: "sale" | "return"): Promise<void> {
  const ref = db.collection(Collections.aggregatorHoldings).doc(holdingId);
  await db.runTransaction(async (tx) => {
    const holding = (await tx.get(ref)).data() as AggregatorHoldingDoc | undefined;
    if (!holding) throw new HoldingClaimError(`No holding ${holdingId}`);
    if (holding.closingAs && holding.closingAs !== exit) {
      throw new HoldingClaimError(`This holding is already being ${holding.closingAs === "sale" ? "sold" : "returned"}`);
    }
    if (!holding.closingAs) tx.update(ref, { closingAs: exit });
  });
}
