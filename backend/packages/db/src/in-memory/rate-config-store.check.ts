// Run: node --experimental-strip-types packages/db/src/in-memory/rate-config-store.check.ts

import assert from "node:assert/strict";
import { loadActiveRates } from "@galleryzone/config";
import { DEFAULT_RATE_SEED } from "@galleryzone/domain";
import { InMemoryRateConfigStore } from "./rate-config-store.ts";

// No store at all — falls back to the literal seed (local dev / before the
// first migration's seed row exists).
{
  const rates = await loadActiveRates(null);
  assert.deepEqual(rates, DEFAULT_RATE_SEED);
}

// An unapproved proposal must never be read, no matter its effectiveFrom.
{
  const store = new InMemoryRateConfigStore();
  const higherGst = { ...DEFAULT_RATE_SEED, gstRate: 0.12 };
  store.propose({ rates: higherGst, effectiveFrom: new Date("2020-01-01"), proposedBy: "admin-1", reason: "test: unapproved change should never be read" });

  const rates = await loadActiveRates(store, new Date("2030-01-01"));
  assert.deepEqual(rates, DEFAULT_RATE_SEED, "an unapproved proposal must fall back to the seed, not leak through");
}

// Self-approval is rejected.
{
  const store = new InMemoryRateConfigStore();
  const versionId = store.propose({ rates: DEFAULT_RATE_SEED, effectiveFrom: new Date("2026-01-01"), proposedBy: "admin-1", reason: "test" });
  assert.throws(() => store.approve({ versionId, approvedBy: "admin-1" }), /self-approved/);
}

// Two-step propose -> approve -> becomes active as of its effectiveFrom.
{
  const store = new InMemoryRateConfigStore();
  const higherGst = { ...DEFAULT_RATE_SEED, gstRate: 0.12 };
  const versionId = store.propose({ rates: higherGst, effectiveFrom: new Date("2026-06-01"), proposedBy: "admin-1", reason: "test: GST rate change" });
  store.approve({ versionId, approvedBy: "admin-2" });

  const before = await loadActiveRates(store, new Date("2026-05-31"));
  assert.deepEqual(before, DEFAULT_RATE_SEED, "before effectiveFrom, the old rate (seed) still applies");

  const after = await loadActiveRates(store, new Date("2026-06-01"));
  assert.equal(after.gstRate, 0.12, "at/after effectiveFrom, the new approved rate applies");
}

// A later approved version supersedes an earlier one, but an already-settled
// transaction (asOf in the past) keeps reading the version live at that time
// — the plan's "changing GST% today never rewrites yesterday's ledger" rule.
{
  const store = new InMemoryRateConfigStore();
  const v1 = store.propose({ rates: { ...DEFAULT_RATE_SEED, gstRate: 0.05 }, effectiveFrom: new Date("2026-01-01"), proposedBy: "admin-1", reason: "test v1" });
  store.approve({ versionId: v1, approvedBy: "admin-2" });
  const v2 = store.propose({ rates: { ...DEFAULT_RATE_SEED, gstRate: 0.12 }, effectiveFrom: new Date("2026-06-01"), proposedBy: "admin-1", reason: "test v2" });
  store.approve({ versionId: v2, approvedBy: "admin-2" });

  const janOrder = await loadActiveRates(store, new Date("2026-01-15"));
  assert.equal(janOrder.gstRate, 0.05, "an order placed in January replays against v1, forever");

  const julyOrder = await loadActiveRates(store, new Date("2026-07-15"));
  assert.equal(julyOrder.gstRate, 0.12, "an order placed in July replays against v2");
}

console.log("packages/db/in-memory/rate-config-store.ts: all propose/approve/versioning checks passed");
