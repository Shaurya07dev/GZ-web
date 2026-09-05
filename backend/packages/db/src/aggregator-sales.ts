// Aggregator's own sales/shipment/remittance management — the read+
// transition surface on top of aggregator_sales rows aggregator-flow.ts
// already creates.

import { and, eq } from "drizzle-orm";
import { shipmentStateMachine, type ShipmentStatus } from "@galleryzone/domain";
import type { Db } from "./client.ts";
import { aggregatorHoldings, aggregatorSales } from "./schema/aggregator.ts";

export class AggregatorSalesError extends Error {}

export async function listAggregatorSales(db: Db, aggregatorId: string) {
  return db
    .select({ sale: aggregatorSales })
    .from(aggregatorSales)
    .innerJoin(aggregatorHoldings, eq(aggregatorSales.holdingId, aggregatorHoldings.id))
    .where(eq(aggregatorHoldings.aggregatorId, aggregatorId))
    .then((rows) => rows.map((r) => r.sale));
}

export async function advanceShipment(db: Db, saleId: string, to: ShipmentStatus, courierRef?: string): Promise<void> {
  const [sale] = await db.select({ shipmentStatus: aggregatorSales.shipmentStatus }).from(aggregatorSales).where(eq(aggregatorSales.id, saleId));
  if (!sale) throw new AggregatorSalesError(`No sale ${saleId}`);
  shipmentStateMachine.assertTransition(sale.shipmentStatus, to);

  const timestampColumn = to === "dispatched" ? { dispatchedAt: new Date() } : { deliveredAt: new Date() };
  await db.update(aggregatorSales).set({ shipmentStatus: to, courierRef: courierRef ?? null, ...timestampColumn }).where(eq(aggregatorSales.id, saleId));
}

/** Confirms the aggregator has remitted a cash sale's FULL price to GalleryZone — never netted against commission (settled 25 Aug 2026 rule). */
export async function markRemitted(db: Db, saleId: string): Promise<void> {
  const [sale] = await db.select({ paymentRoute: aggregatorSales.paymentRoute, remittedAt: aggregatorSales.remittedAt }).from(aggregatorSales).where(eq(aggregatorSales.id, saleId));
  if (!sale) throw new AggregatorSalesError(`No sale ${saleId}`);
  if (sale.paymentRoute !== "cash_at_premises") throw new AggregatorSalesError("Only cash_at_premises sales require remittance");
  if (sale.remittedAt) throw new AggregatorSalesError(`Sale ${saleId} was already marked remitted`);
  await db.update(aggregatorSales).set({ remittedAt: new Date() }).where(eq(aggregatorSales.id, saleId));
}

export async function listRemittancesDue(db: Db, aggregatorId: string) {
  return db
    .select({ sale: aggregatorSales })
    .from(aggregatorSales)
    .innerJoin(aggregatorHoldings, eq(aggregatorSales.holdingId, aggregatorHoldings.id))
    .where(and(eq(aggregatorHoldings.aggregatorId, aggregatorId), eq(aggregatorSales.paymentRoute, "cash_at_premises")))
    .then((rows) => rows.map((r) => r.sale).filter((sale) => !sale.remittedAt));
}
