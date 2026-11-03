// Invoice numbering — the two facts a GST tax invoice cannot get wrong.
//
// CGST Rule 46 wants a number that is stable and sequential per supplier per
// fiscal year. Once an invoice is issued and filed it cannot be renumbered,
// so the format and the fiscal-year boundary are pinned here rather than
// discovered in production.

import assert from "node:assert/strict";
import { fiscalYearOf, formatInvoiceNumber } from "./invoices.ts";

// The number carries the short year once, not twice. The original read
// `GZ/${fiscalYear.slice(4, 6)}${short}/...`, where `short` was already
// "26-27" — printing GZ/2626-27/000001 on every invoice.
assert.equal(formatInvoiceNumber("FY2026-27", 1), "GZ/26-27/000001");
assert.equal(formatInvoiceNumber("FY2026-27", 42), "GZ/26-27/000042");
assert.equal(formatInvoiceNumber("FY2027-28", 999_999), "GZ/27-28/999999");

// The fiscal year is an IST fact, and this API runs on UTC. Each pair below
// is an instant expressed in UTC; the comment says what it is in IST.
const cases: [string, string][] = [
  ["2026-04-01T00:00:00Z", "FY2026-27"], // 05:30 IST, 1 Apr — new year
  ["2026-03-31T18:29:59Z", "FY2025-26"], // 23:59 IST, 31 Mar — still the old one
  ["2026-03-31T18:30:00Z", "FY2026-27"], // 00:00 IST, 1 Apr — the boundary
  ["2026-03-31T20:00:00Z", "FY2026-27"], // 01:30 IST, 1 Apr — the case UTC got wrong
  ["2026-11-03T12:00:00Z", "FY2026-27"], // mid-year
  ["2027-01-15T12:00:00Z", "FY2026-27"], // January is still FY26-27
];
for (const [iso, expected] of cases) {
  assert.equal(
    fiscalYearOf(new Date(iso)),
    expected,
    `${iso} should fall in ${expected}`,
  );
}

// Every instant of a fiscal year maps to that year, and the year rolls over
// exactly once across a two-year sweep — no gaps, no double rollover.
let rollovers = 0;
let previous = fiscalYearOf(new Date("2025-06-01T00:00:00Z"));
for (let day = 0; day < 730; day += 1) {
  const at = new Date(Date.UTC(2025, 5, 1) + day * 86_400_000);
  const current = fiscalYearOf(at);
  if (current !== previous) {
    rollovers += 1;
    previous = current;
  }
}
assert.equal(rollovers, 2, "two fiscal-year rollovers across 730 days");

console.log("packages/db/invoices.ts: invoice number format and IST fiscal-year boundary hold");
