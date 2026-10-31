// Aggregator cash-remittance through Razorpay — audit §5.
//
// Owner directive (30 Oct 2026): cash-at-premises remittance moves off a
// manual bank-transfer confirmation to a Razorpay payment. One remittance
// doc = one Razorpay order; it may cover one or several sales at once,
// which batches short deadlines into a single checkout and a single receipt.
//
// Same hardened pattern as orders and top-ups: nothing the browser says is
// sufficient to settle money; the gateway order is re-read on both the
// browser-side verify and the webhook, and only then stamps the sales as
// remitted. markRemittancePaid is transactional and idempotent — a second
// report of the same payment is a no-op.
//
// The wallet/bank variants stay on `markRemitted` in aggregator-sales.ts for
// backward compat with legacy sales recorded before this flow existed.

import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import {
  Collections,
  type AggregatorHoldingDoc,
  type AggregatorRemittanceDoc,
  type AggregatorSaleDoc,
} from "./collections.ts";
import { DbError } from "./errors.ts";

export class AggregatorRemittanceError extends DbError {}

export type AggregatorRemittance = AggregatorRemittanceDoc & { id: string };

/** Razorpay's receipt field caps at 40 chars, so the number of sales per
 *  remittance has to stay small enough that the batch fits a single checkout.
 *  A hard cap also stops a stray `[]` from eating the entire remittances list. */
export const REMITTANCE_MAX_SALES = 20;

async function readSaleAndHolding(
  tx: Transaction,
  db: Firestore,
  saleId: string,
): Promise<{ sale: AggregatorSaleDoc; holding: AggregatorHoldingDoc }> {
  const saleRef = db.collection(Collections.aggregatorSales).doc(saleId);
  const saleSnap = await tx.get(saleRef);
  if (!saleSnap.exists) throw new AggregatorRemittanceError(`No sale ${saleId}`);
  const sale = saleSnap.data() as AggregatorSaleDoc;
  const holdingSnap = await tx.get(
    db.collection(Collections.aggregatorHoldings).doc(sale.holdingId),
  );
  if (!holdingSnap.exists) throw new AggregatorRemittanceError(`No sale ${saleId}`);
  return { sale, holding: holdingSnap.data() as AggregatorHoldingDoc };
}

/**
 * Opens a new pending remittance for the given sales. Validates ownership,
 * payment route and remittance state in one transaction before writing the
 * doc, so a sale already queued inside another pending remittance can't be
 * double-counted. The remittance's `amountPaise` is derived from the sales,
 * never from the client — same rule as the artwork order's totalPaise.
 */
export async function createRemittance(
  db: Firestore,
  input: { aggregatorId: string; saleIds: string[] },
): Promise<{ remittanceId: string; amountPaise: number }> {
  if (input.saleIds.length === 0) {
    throw new AggregatorRemittanceError("Pick at least one sale to remit");
  }
  if (input.saleIds.length > REMITTANCE_MAX_SALES) {
    throw new AggregatorRemittanceError(`Remit at most ${REMITTANCE_MAX_SALES} sales at a time`);
  }
  // De-duplicate so the same sale sent twice doesn't double the amount.
  const unique = [...new Set(input.saleIds)];

  const ref = db.collection(Collections.aggregatorRemittances).doc();
  const amountPaise = await db.runTransaction(async (tx) => {
    let total = 0;
    for (const saleId of unique) {
      const { sale, holding } = await readSaleAndHolding(tx, db, saleId);
      // Same message as a missing sale: a stranger must not learn the id is real.
      if (holding.aggregatorId !== input.aggregatorId) {
        throw new AggregatorRemittanceError(`No sale ${saleId}`);
      }
      if (sale.paymentRoute !== "cash_at_premises") {
        throw new AggregatorRemittanceError("Only cash sales need remittance");
      }
      if (sale.remittedAt) {
        throw new AggregatorRemittanceError(`Sale ${saleId} was already marked remitted`);
      }
      total += sale.soldPricePaise;
    }
    const doc: AggregatorRemittanceDoc = {
      aggregatorId: input.aggregatorId,
      saleIds: unique,
      amountPaise: total,
      status: "pending",
      providerOrderId: null,
      providerPaymentId: null,
      method: null,
      createdAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
      paidAt: null,
    };
    tx.set(ref, doc);
    return total;
  });
  return { remittanceId: ref.id, amountPaise };
}

export async function getRemittance(
  db: Firestore,
  remittanceId: string,
): Promise<AggregatorRemittance | null> {
  const snap = await db.collection(Collections.aggregatorRemittances).doc(remittanceId).get();
  return snap.exists ? { id: snap.id, ...(snap.data() as AggregatorRemittanceDoc) } : null;
}

export async function attachRemittanceProviderOrder(
  db: Firestore,
  remittanceId: string,
  providerOrderId: string,
): Promise<void> {
  await db
    .collection(Collections.aggregatorRemittances)
    .doc(remittanceId)
    .update({ providerOrderId });
}

export async function remittanceIdForProviderOrder(
  db: Firestore,
  providerOrderId: string,
): Promise<string | null> {
  const snap = await db
    .collection(Collections.aggregatorRemittances)
    .where("providerOrderId", "==", providerOrderId)
    .limit(1)
    .get();
  return snap.docs[0]?.id ?? null;
}

/**
 * Stamps every sale in the remittance as remitted and flips the remittance
 * doc itself to `paid`, in one transaction. A second report of the same
 * payment (webhook racing with verify) is a no-op — the status check happens
 * inside the transaction.
 */
export async function markRemittancePaid(
  db: Firestore,
  remittanceId: string,
  capture: { method: string; providerPaymentId: string | null },
): Promise<{ aggregatorId: string; amountPaise: number; saleIds: string[]; alreadyPaid: boolean }> {
  const ref = db.collection(Collections.aggregatorRemittances).doc(remittanceId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AggregatorRemittanceError(`No remittance ${remittanceId}`);
    const rem = snap.data() as AggregatorRemittanceDoc;
    if (rem.status === "paid") {
      return { aggregatorId: rem.aggregatorId, amountPaise: rem.amountPaise, saleIds: rem.saleIds, alreadyPaid: true };
    }
    for (const saleId of rem.saleIds) {
      const saleRef = db.collection(Collections.aggregatorSales).doc(saleId);
      tx.update(saleRef, {
        remittedAt: FieldValue.serverTimestamp(),
        remittedVia: "razorpay",
        remittanceId,
      });
    }
    tx.update(ref, {
      status: "paid",
      method: capture.method,
      providerPaymentId: capture.providerPaymentId,
      paidAt: FieldValue.serverTimestamp(),
    });
    return { aggregatorId: rem.aggregatorId, amountPaise: rem.amountPaise, saleIds: rem.saleIds, alreadyPaid: false };
  });
}

/** The gateway declined. The sales stay unremitted; the aggregator can start again. */
export async function markRemittanceFailed(
  db: Firestore,
  remittanceId: string,
  detail: { providerPaymentId: string | null },
): Promise<void> {
  const ref = db.collection(Collections.aggregatorRemittances).doc(remittanceId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const rem = snap.data() as AggregatorRemittanceDoc;
    if (rem.status !== "pending") return;
    tx.update(ref, { status: "failed", providerPaymentId: detail.providerPaymentId });
  });
}
