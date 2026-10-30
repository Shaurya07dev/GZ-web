// Run: node --experimental-strip-types packages/db/src/checkout.check.ts
// A sale settles on the artist price fixed when the buyer's total was, not on
// whatever the artist has edited it to since.

import assert from "node:assert/strict";
import { settlementPricingOf } from "./checkout.ts";

const live = { artistId: "artist-1", artistPricePaise: 1_000_000_000 }; // raised after the order opened

assert.deepEqual(
  settlementPricingOf({ artistId: "artist-1", artistPricePaise: 5_000_000 }, live),
  { artistId: "artist-1", artistPricePaise: 5_000_000 },
  "the snapshot on the order wins over a later price edit",
);
assert.deepEqual(settlementPricingOf({}, live), live, "orders from before the snapshot existed settle on the live doc");
assert.deepEqual(settlementPricingOf({ artistPricePaise: 5_000_000 }, live), live, "a half snapshot is ignored, never mixed with live fields");

console.log("packages/db/checkout.ts: sales settle on the order's price snapshot");
