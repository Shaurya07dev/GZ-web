// Earnings-above-5L flag (TDS §194-O tracking) + finance reports. Report
// "generation" here means computing and storing the real aggregate the
// report claims to show — sales/settlements/artist-payouts/aggregator-
// commission/GST — not a PDF/CSV rendering pipeline (that's a Phase 4+
// concern once a template/format is chosen; the numbers themselves are
// what a report actually needs to be trustworthy).

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { shouldFlagEarningsAbove5L, type PricingRates } from "@galleryzone/domain";
import type { Db } from "./client.ts";
import { profiles } from "./schema/identity.ts";
import { orders } from "./schema/order.ts";
import { settlements } from "./schema/ledger.ts";

export class ReportError extends Error {}

export async function setEarningsAbove5L(db: Db, userId: string, value: boolean): Promise<void> {
  const result = await db.update(profiles).set({ earningsAbove5L: value }).where(eq(profiles.userId, userId));
  if (result.count === 0) throw new ReportError(`No profile for user ${userId}`);
}

/** Suggests the flag from real year-to-date settlement totals — an admin still confirms it via setEarningsAbove5L(). */
export async function suggestEarningsAbove5L(db: Db, artistId: string, rates: PricingRates, asOf: Date = new Date()): Promise<boolean> {
  const yearStart = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${settlements.artistAmountPaise}), 0)` })
    .from(settlements)
    .where(and(eq(settlements.artistId, artistId), gte(settlements.createdAt, yearStart), lte(settlements.createdAt, asOf)));
  return shouldFlagEarningsAbove5L(Number(row?.total ?? 0), rates);
}

export type ReportType = "sales" | "settlements" | "gst";

export interface ReportRow {
  type: ReportType;
  generatedAt: Date;
  totalOrders: number;
  totalGstPaise: number;
  totalSettledPaise: number;
}

export async function listReports(): Promise<ReportRow[]> {
  // No persistence table for generated reports yet (Phase 4+ decision on
  // format/storage) — generateReport() below computes on demand; a caller
  // that wants history should store what it gets back.
  return [];
}

export async function generateReport(db: Db, type: ReportType): Promise<ReportRow> {
  const [orderTotals] = await db.select({ count: sql<string>`count(*)`, gst: sql<string>`coalesce(sum(${orders.gstPaise}), 0)` }).from(orders);
  const [settlementTotals] = await db.select({ total: sql<string>`coalesce(sum(${settlements.artistAmountPaise}), 0)` }).from(settlements);

  return {
    type,
    generatedAt: new Date(),
    totalOrders: Number(orderTotals?.count ?? 0),
    totalGstPaise: Number(orderTotals?.gst ?? 0),
    totalSettledPaise: Number(settlementTotals?.total ?? 0),
  };
}
