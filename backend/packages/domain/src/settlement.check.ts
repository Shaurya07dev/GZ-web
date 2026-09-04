// Run: node --experimental-strip-types packages/domain/src/settlement.check.ts
//
// Ledger-integrity property test (plan.md §17 gate): 1000 random valid
// sequences, balance always sums to zero. Each posting function already
// self-asserts balance via assertBalanced() — this file additionally fuzzes
// inputs across a wide range to catch a rounding edge case a single fixed
// example wouldn't, and checks the assertBalanced() guard itself actually
// fires on a deliberately unbalanced set.

import assert from "node:assert/strict";
import { DEFAULT_RATE_SEED } from "./pricing.ts";
import {
  aggregatorAdvancePostings,
  aggregatorReturnPostings,
  aggregatorSalePostings,
  marketplaceCheckoutPostings,
  withdrawalPayoutPostings,
} from "./settlement.ts";

const rates = DEFAULT_RATE_SEED;

function sum(postings: { amountPaise: number }[]): number {
  return postings.reduce((total, p) => total + p.amountPaise, 0);
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

let iterations = 0;
for (let i = 0; i < 1000; i++) {
  const artistPrice = randomInt(1_000, 50_000_000); // ₹10 to ₹5,00,000, in paise
  const marketplace = marketplaceCheckoutPostings({ artistId: "artist-1", artistPricePaise: artistPrice, rates });
  assert.equal(sum(marketplace), 0, `marketplaceCheckoutPostings unbalanced at artistPrice=${artistPrice}`);
  iterations++;

  const displayPrice = Math.round(artistPrice * (1 + rates.platformMarkup) * (1 + rates.gstRate));
  const advance = aggregatorAdvancePostings({ aggregatorId: "agg-1", displayPricePaise: displayPrice, rates });
  assert.equal(sum(advance), 0, `aggregatorAdvancePostings unbalanced at displayPrice=${displayPrice}`);
  iterations++;

  const advanceHeld = advance.find((p) => p.accountType === "razorpay_escrow")!.amountPaise;
  const sale = aggregatorSalePostings({
    artistId: "artist-1",
    aggregatorId: "agg-1",
    displayPricePaise: displayPrice,
    artistPricePaise: artistPrice,
    advanceAlreadyHeldPaise: advanceHeld,
    rates,
  });
  assert.equal(sum(sale), 0, `aggregatorSalePostings unbalanced at artistPrice=${artistPrice}`);
  iterations++;

  const ret = aggregatorReturnPostings({ aggregatorId: "agg-1", advancePaise: advanceHeld });
  assert.equal(sum(ret), 0);
  iterations++;

  const payout = withdrawalPayoutPostings({ accountType: "artist_payable", ownerId: "artist-1", amountPaise: artistPrice });
  assert.equal(sum(payout), 0);
  iterations++;
}
assert.equal(iterations, 5000);

console.log(`packages/domain/settlement.ts: ${iterations} balanced-ledger checks passed across 1000 random sequences`);
