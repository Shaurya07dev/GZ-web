// Run: node --experimental-strip-types packages/domain/src/policies.check.ts

import assert from "node:assert/strict";
import { DEFAULT_RATE_SEED } from "./pricing.ts";
import {
  canEditArtwork,
  editWindowExpiresAt,
  externalSalePenaltyOf,
  insuranceRecommended,
  meetsMinCustomerWithdrawal,
  meetsMinWithdrawal,
  shouldFlagEarningsAbove5L,
} from "./policies.ts";

const rates = DEFAULT_RATE_SEED;

// --- Edit window ---------------------------------------------------------------
{
  const listedAt = "2026-01-01T00:00:00.000Z";
  assert.equal(editWindowExpiresAt(listedAt, rates).toISOString(), "2026-01-08T00:00:00.000Z");

  assert.equal(
    canEditArtwork({ firstListedAt: listedAt, status: "marketplace", rates, now: new Date("2026-01-05T00:00:00.000Z") }),
    true,
    "inside the 7-day window and not purchase-locked",
  );
  assert.equal(
    canEditArtwork({ firstListedAt: listedAt, status: "marketplace", rates, now: new Date("2026-01-09T00:00:00.000Z") }),
    false,
    "past the 7-day window",
  );
  assert.equal(
    canEditArtwork({ firstListedAt: listedAt, status: "sold", rates, now: new Date("2026-01-02T00:00:00.000Z") }),
    false,
    "purchase-locked status blocks editing even inside the window",
  );
  assert.equal(
    canEditArtwork({ firstListedAt: listedAt, status: "draft", rates, now: new Date("2026-01-02T00:00:00.000Z") }),
    true,
    "draft is not purchase-locked",
  );
}

// --- External-sale penalty ------------------------------------------------------
{
  assert.equal(externalSalePenaltyOf(100_000_00, rates), 100_000, "1% of ₹1,00,000 = ₹1,000 (in paise)");
}

// --- Withdrawal minimums ----------------------------------------------------------
{
  assert.equal(meetsMinWithdrawal(100_000, rates), true, "exactly ₹1,000 meets the artist/aggregator minimum");
  assert.equal(meetsMinWithdrawal(99_999, rates), false);
  assert.equal(meetsMinCustomerWithdrawal(50_000, rates), true, "exactly ₹500 meets the customer minimum");
  assert.equal(meetsMinCustomerWithdrawal(49_999, rates), false);
}

// --- Insurance / TDS thresholds -----------------------------------------------------
{
  assert.equal(insuranceRecommended(2_000_000, rates), true, "exactly ₹20,000 recommends insurance");
  assert.equal(insuranceRecommended(1_999_999, rates), false);
  assert.equal(shouldFlagEarningsAbove5L(50_000_000, rates), true, "exactly ₹5,00,000 flags TDS tracking");
  assert.equal(shouldFlagEarningsAbove5L(49_999_999, rates), false);
}

console.log("packages/domain/policies.ts checks passed");
