// Run: node --experimental-strip-types packages/domain/src/aggregator-cycle.check.ts

import assert from "node:assert/strict";
import { DEFAULT_RATE_SEED } from "./pricing.ts";
import { decideNextAggregatorStep } from "./aggregator-cycle.ts";

const rates = DEFAULT_RATE_SEED;
const cycleStart = "2026-01-01T00:00:00.000Z";
const artistPrice = 100_000_00; // ₹1,00,000 in paise

// No placements yet — first offer is month 1.
{
  const outcome = decideNextAggregatorStep({
    artistPricePaise: artistPrice,
    cycleStartedAt: cycleStart,
    history: [],
    now: new Date(cycleStart),
    rates,
  });
  assert.equal(outcome.kind, "offer_to_next_aggregator");
  if (outcome.kind === "offer_to_next_aggregator") {
    assert.equal(outcome.month, 1);
    assert.equal(outcome.offerPricePaise, 130_000_00);
    assert.equal(outcome.advance.basis, "display_price");
  }
}

// Five placements already made — cycle ceiling hit, piece goes home.
{
  const history = Array.from({ length: 5 }, (_, i) => ({
    aggregatorId: `agg-${i}`,
    month: i + 1,
    assignedAt: cycleStart,
    returnedAt: cycleStart,
    changedPrice: false,
  }));
  const outcome = decideNextAggregatorStep({
    artistPricePaise: artistPrice,
    cycleStartedAt: cycleStart,
    history,
    now: new Date(Date.parse(cycleStart) + 100 * 86_400_000),
    rates,
  });
  assert.equal(outcome.kind, "return_to_artist");
}

// Late in the window (< 30 days left) — also goes home even with placements to spare.
{
  const outcome = decideNextAggregatorStep({
    artistPricePaise: artistPrice,
    cycleStartedAt: cycleStart,
    history: [{ aggregatorId: "agg-1", month: 1, assignedAt: cycleStart, returnedAt: cycleStart, changedPrice: false }],
    now: new Date(Date.parse(cycleStart) + 160 * 86_400_000),
    rates,
  });
  assert.equal(outcome.kind, "return_to_artist");
}

console.log("packages/domain/aggregator-cycle.ts checks passed");
