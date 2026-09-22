// Earnings-above-5L flag + finance reports — Firestore version. Report
// "generation" computes real aggregates on demand, same as the Postgres
// version — no rendering pipeline, no persistence table yet.

import type { Firestore } from "firebase-admin/firestore";
import { shouldFlagEarningsAbove5L, type PricingRates } from "@galleryzone/domain";
import { Collections, userProfileCol, type OrderDoc, type SettlementDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class ReportError extends DbError {}

export async function setEarningsAbove5L(db: Firestore, userId: string, value: boolean): Promise<void> {
  const ref = db.collection(userProfileCol(userId)).doc("data");
  const snap = await ref.get();
  if (!snap.exists) throw new ReportError(`No profile for user ${userId}`);
  await ref.update({ earningsAbove5L: value });
}

/** Suggests the flag from real year-to-date settlement totals — an admin still confirms it via setEarningsAbove5L(). */
export async function suggestEarningsAbove5L(db: Firestore, artistId: string, rates: PricingRates, asOf: Date = new Date()): Promise<boolean> {
  const yearStart = Date.UTC(asOf.getUTCFullYear(), 0, 1);
  const until = asOf.getTime();
  // Equality on artistId only, with the date window applied in memory. The
  // range filter used to be in the query, which makes it a composite index
  // Firestore will not serve without a deploy — and it took the whole admin
  // user page down with a FAILED_PRECONDITION 500 rather than just losing the
  // suggestion. One artist's settlements is a small read; correctness here
  // must not depend on an index having been created.
  const snap = await db.collection(Collections.settlements).where("artistId", "==", artistId).get();
  const total = snap.docs.reduce((sum, d) => {
    const settlement = d.data() as SettlementDoc;
    const at = settlement.createdAt?.toMillis?.() ?? 0;
    return at >= yearStart && at <= until ? sum + settlement.artistAmountPaise : sum;
  }, 0);
  return shouldFlagEarningsAbove5L(total, rates);
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
  // No persistence table for generated reports yet — same Phase 4+ open
  // decision as the Postgres version.
  return [];
}

export async function generateReport(db: Firestore, type: ReportType): Promise<ReportRow> {
  const [orderSnap, settlementSnap] = await Promise.all([db.collection(Collections.orders).get(), db.collection(Collections.settlements).get()]);
  const totalGstPaise = orderSnap.docs.reduce((sum, d) => sum + (d.data() as OrderDoc).gstPaise, 0);
  const totalSettledPaise = settlementSnap.docs.reduce((sum, d) => sum + (d.data() as SettlementDoc).artistAmountPaise, 0);

  return { type, generatedAt: new Date(), totalOrders: orderSnap.size, totalGstPaise, totalSettledPaise };
}
