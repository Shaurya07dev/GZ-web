// Self-check for the rules in types/artwork.ts that are easy to get wrong:
// the 7-day-or-purchase edit window, the channel predicates, and the
// off-platform sale fee. No test framework — run it directly:
//
//   node --experimental-strip-types types/artwork.check.ts
//
import assert from "node:assert/strict";
import {
  ARTWORK_EDIT_WINDOW_DAYS,
  EXTERNAL_SALE_PENALTY_RATE,
  artworkEditState,
  isAggregatorListed,
  isMarketplaceListed,
  resolveCustody,
  type Artwork,
  type ArtworkStatus,
} from "./artwork.ts";

const NOW = Date.parse("2026-08-20T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function listed(status: ArtworkStatus, daysAgo: number) {
  return {
    status,
    statusHistory: [
      { status, changedAt: new Date(NOW - daysAgo * DAY).toISOString() },
    ],
  };
}

// --- edit window -------------------------------------------------------------

const fresh = artworkEditState(listed("marketplace", 2), NOW);
assert.equal(fresh.editable, true, "2 days in, still editable");
assert.equal(fresh.daysLeft, 5, "5 of the 7 days left");

const stale = artworkEditState(listed("marketplace", 8), NOW);
assert.equal(stale.editable, false, "past 7 days, closed");
assert.equal(stale.reason, "window_closed");

const edge = artworkEditState(listed("marketplace", ARTWORK_EDIT_WINDOW_DAYS), NOW);
assert.equal(edge.editable, false, "exactly 7 days in, closed");

// A purchase inside the window overrides the days remaining.
const boughtEarly = artworkEditState(listed("sold", 2), NOW);
assert.equal(boughtEarly.editable, false, "sold on day 2, locked immediately");
assert.equal(boughtEarly.reason, "purchased");
assert.equal(artworkEditState(listed("reserved", 1), NOW).editable, false);

// Drafts are not listed yet, so the clock hasn't started.
assert.equal(artworkEditState(listed("draft", 99), NOW).editable, true);

// --- sales channels ----------------------------------------------------------

assert.equal(isMarketplaceListed("marketplace_only"), true);
assert.equal(isMarketplaceListed("aggregator_only"), false);
assert.equal(isMarketplaceListed("marketplace_and_aggregator"), true);
assert.equal(isAggregatorListed("marketplace_only"), false);
assert.equal(isAggregatorListed("aggregator_only"), true);
assert.equal(isAggregatorListed("marketplace_and_aggregator"), true);

// --- off-platform sale fee ---------------------------------------------------

assert.equal(
  Math.round(100_000 * EXTERNAL_SALE_PENALTY_RATE),
  1_000,
  "1% of a ₹1,00,000 listing is ₹1,000",
);

// --- custody -----------------------------------------------------------------

const withAggregator = {
  ...listed("with_aggregator", 30),
  custody: null,
} as unknown as Artwork;
const derived = resolveCustody(withAggregator);
assert.equal(derived.legalOwner, "artist", "aggregator holds it, artist owns it");
assert.equal(derived.custodian, "aggregator");

const explicit = {
  ...listed("marketplace", 1),
  custody: {
    legalOwner: "galleryzone" as const,
    custodian: "aggregator" as const,
    locationLabel: "Bengaluru",
  },
} as unknown as Artwork;
assert.equal(resolveCustody(explicit).legalOwner, "galleryzone", "stored wins");

console.log("types/artwork.ts checks passed");
