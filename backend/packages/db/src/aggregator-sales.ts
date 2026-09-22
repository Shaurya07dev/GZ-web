// Aggregator's own sales/shipment/remittance management — Firestore version.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { shipmentStateMachine, type ShipmentStatus } from "@galleryzone/domain";
import { Collections, type AggregatorHoldingDoc, type AggregatorSaleDoc } from "./collections.ts";

export class AggregatorSalesError extends Error {}

// aggregatorSales doesn't carry aggregatorId directly (it's on the parent
// holding) — resolve via the holdings the aggregator owns first, same
// "join" the Postgres version did with an INNER JOIN, done here as two
// queries since Firestore has no cross-collection join.
async function holdingIdsFor(db: Firestore, aggregatorId: string): Promise<string[]> {
  const snap = await db.collection(Collections.aggregatorHoldings).where("aggregatorId", "==", aggregatorId).get();
  return snap.docs.map((d) => d.id);
}

export async function listAggregatorSales(db: Firestore, aggregatorId: string): Promise<(AggregatorSaleDoc & { id: string })[]> {
  const holdingIds = await holdingIdsFor(db, aggregatorId);
  if (holdingIds.length === 0) return [];
  // Firestore's `in` operator caps at 30 values, so the holdings are queried
  // in chunks of 30 and merged. An aggregator past their 30th holding used to
  // silently lose every sale after it.
  const chunks: string[][] = [];
  for (let i = 0; i < holdingIds.length; i += 30) chunks.push(holdingIds.slice(i, i + 30));
  const snaps = await Promise.all(
    chunks.map((chunk) => db.collection(Collections.aggregatorSales).where("holdingId", "in", chunk).get()),
  );
  return snaps.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...(d.data() as AggregatorSaleDoc) })));
}

// A sale is owned by whoever owns its parent holding. Every mutation resolves
// that here rather than trusting the caller, so a sale id from another
// aggregator can't be advanced or marked remitted.
async function ownedSale(db: Firestore, saleId: string, aggregatorId: string): Promise<AggregatorSaleDoc> {
  const snap = await db.collection(Collections.aggregatorSales).doc(saleId).get();
  if (!snap.exists) throw new AggregatorSalesError(`No sale ${saleId}`);
  const sale = snap.data() as AggregatorSaleDoc;
  const holding = (await db.collection(Collections.aggregatorHoldings).doc(sale.holdingId).get()).data() as
    | AggregatorHoldingDoc
    | undefined;
  // Same message as a missing sale: a stranger must not learn that the id is real.
  if (!holding || holding.aggregatorId !== aggregatorId) throw new AggregatorSalesError(`No sale ${saleId}`);
  return sale;
}

export async function advanceShipment(db: Firestore, aggregatorId: string, saleId: string, to: ShipmentStatus, courierRef?: string): Promise<void> {
  const sale = await ownedSale(db, saleId, aggregatorId);
  const ref = db.collection(Collections.aggregatorSales).doc(saleId);
  shipmentStateMachine.assertTransition(sale.shipmentStatus, to);

  const timestampField = to === "dispatched" ? "dispatchedAt" : "deliveredAt";
  await ref.update({ shipmentStatus: to, courierRef: courierRef ?? null, [timestampField]: FieldValue.serverTimestamp() });
}

/** Confirms the aggregator has remitted a cash sale's FULL price to GalleryZone — never netted against commission. */
export async function markRemitted(db: Firestore, aggregatorId: string, saleId: string): Promise<void> {
  const sale = await ownedSale(db, saleId, aggregatorId);
  const ref = db.collection(Collections.aggregatorSales).doc(saleId);
  if (sale.paymentRoute !== "cash_at_premises") throw new AggregatorSalesError("Only cash_at_premises sales require remittance");
  if (sale.remittedAt) throw new AggregatorSalesError(`Sale ${saleId} was already marked remitted`);
  await ref.update({ remittedAt: FieldValue.serverTimestamp() });
}

export async function listRemittancesDue(db: Firestore, aggregatorId: string): Promise<(AggregatorSaleDoc & { id: string })[]> {
  const sales = await listAggregatorSales(db, aggregatorId);
  return sales.filter((sale) => sale.paymentRoute === "cash_at_premises" && !sale.remittedAt);
}
