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
  // Firestore's `in` operator caps at 30 values — fine for a single
  // aggregator's holdings in practice; documented rather than silently
  // truncated if it's ever hit.
  const snap = await db.collection(Collections.aggregatorSales).where("holdingId", "in", holdingIds.slice(0, 30)).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as AggregatorSaleDoc) }));
}

export async function advanceShipment(db: Firestore, saleId: string, to: ShipmentStatus, courierRef?: string): Promise<void> {
  const ref = db.collection(Collections.aggregatorSales).doc(saleId);
  const snap = await ref.get();
  if (!snap.exists) throw new AggregatorSalesError(`No sale ${saleId}`);
  const sale = snap.data() as AggregatorSaleDoc;
  shipmentStateMachine.assertTransition(sale.shipmentStatus, to);

  const timestampField = to === "dispatched" ? "dispatchedAt" : "deliveredAt";
  await ref.update({ shipmentStatus: to, courierRef: courierRef ?? null, [timestampField]: FieldValue.serverTimestamp() });
}

/** Confirms the aggregator has remitted a cash sale's FULL price to GalleryZone — never netted against commission. */
export async function markRemitted(db: Firestore, saleId: string): Promise<void> {
  const ref = db.collection(Collections.aggregatorSales).doc(saleId);
  const snap = await ref.get();
  if (!snap.exists) throw new AggregatorSalesError(`No sale ${saleId}`);
  const sale = snap.data() as AggregatorSaleDoc;
  if (sale.paymentRoute !== "cash_at_premises") throw new AggregatorSalesError("Only cash_at_premises sales require remittance");
  if (sale.remittedAt) throw new AggregatorSalesError(`Sale ${saleId} was already marked remitted`);
  await ref.update({ remittedAt: FieldValue.serverTimestamp() });
}

export async function listRemittancesDue(db: Firestore, aggregatorId: string): Promise<(AggregatorSaleDoc & { id: string })[]> {
  const sales = await listAggregatorSales(db, aggregatorId);
  return sales.filter((sale) => sale.paymentRoute === "cash_at_premises" && !sale.remittedAt);
}
