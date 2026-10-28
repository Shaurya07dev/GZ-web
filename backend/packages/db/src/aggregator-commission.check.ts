// Run: node --experimental-strip-types packages/db/src/aggregator-commission.check.ts

import assert from "node:assert/strict";
import { DEFAULT_RATE_SEED } from "@galleryzone/domain";
import {
  eligibleMonthlySalesPaiseFromRows,
  previousCalendarMonthRangeUtc,
} from "./aggregator-commission.ts";

const R = (rupees: number) => rupees * 100;

const range = previousCalendarMonthRangeUtc(new Date("2026-10-24T12:00:00.000Z"));
assert.equal(range.start.toISOString(), "2026-09-01T00:00:00.000Z");
assert.equal(range.end.toISOString(), "2026-10-01T00:00:00.000Z");

assert.equal(
  eligibleMonthlySalesPaiseFromRows(
    [
      { soldPricePaise: R(105_000), soldAt: new Date("2026-08-31T23:59:59.999Z") },
      { soldPricePaise: R(105_000), soldAt: new Date("2026-09-01T00:00:00.000Z") },
      { soldPricePaise: R(210_000), soldAt: new Date("2026-09-30T23:59:59.999Z") },
      { soldPricePaise: R(105_000), soldAt: new Date("2026-10-01T00:00:00.000Z") },
    ],
    range,
    DEFAULT_RATE_SEED,
  ),
  R(300_000),
  "only previous-month successful sales count, with GST removed",
);

console.log("packages/db/aggregator-commission.ts checks passed");
