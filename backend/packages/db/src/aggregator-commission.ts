// Aggregator incentive-tier reader for Aggregator MOU 2026.3 §9.
//
// The rate used this month is based only on the immediately preceding
// calendar month's successful sales. "Eligible Monthly Sales" is the sum of
// listed selling prices before GST; it is not lifetime sales and it is not the
// markup pool on which the eventual incentive is calculated.

import type { Firestore } from "firebase-admin/firestore";
import { Collections, type AggregatorSaleDoc } from "./collections.ts";
import { exGst, type PricingRates } from "@galleryzone/domain";

export interface UtcMonthRange {
  start: Date;
  end: Date;
}

export interface EligibleSaleRow {
  soldPricePaise: number;
  soldAt: Date;
}

/** The half-open UTC range for the calendar month immediately before `at`. */
export function previousCalendarMonthRangeUtc(at: Date): UtcMonthRange {
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  return { start, end };
}

/** Sum eligible listed selling prices before GST inside a half-open month. */
export function eligibleMonthlySalesPaiseFromRows(
  rows: readonly EligibleSaleRow[],
  range: UtcMonthRange,
  rates: PricingRates,
): number {
  return rows
    .filter((sale) => sale.soldAt >= range.start && sale.soldAt < range.end)
    .reduce((total, sale) => total + exGst(sale.soldPricePaise, rates), 0);
}

/** Read the immediately previous month's successful, pre-GST listed sales. */
export async function aggregatorEligibleSalesInPreviousMonthPaise(
  db: Firestore,
  aggregatorId: string,
  at: Date,
  rates: PricingRates,
): Promise<number> {
  const holdingsSnap = await db
    .collection(Collections.aggregatorHoldings)
    .where("aggregatorId", "==", aggregatorId)
    .get();
  const holdingIds = holdingsSnap.docs.map((doc) => doc.id);
  if (holdingIds.length === 0) return 0;

  const batches: string[][] = [];
  for (let i = 0; i < holdingIds.length; i += 30) {
    batches.push(holdingIds.slice(i, i + 30));
  }
  const snapshots = await Promise.all(
    batches.map((ids) =>
      db
        .collection(Collections.aggregatorSales)
        .where("holdingId", "in", ids)
        .get(),
    ),
  );
  const rows: EligibleSaleRow[] = snapshots.flatMap((snapshot) =>
    snapshot.docs.flatMap((doc) => {
      const sale = doc.data() as AggregatorSaleDoc;
      return sale.soldAt
        ? [{ soldPricePaise: sale.soldPricePaise, soldAt: sale.soldAt.toDate() }]
        : [];
    }),
  );
  return eligibleMonthlySalesPaiseFromRows(
    rows,
    previousCalendarMonthRangeUtc(at),
    rates,
  );
}
