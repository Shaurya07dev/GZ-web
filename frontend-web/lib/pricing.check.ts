// Run: node --experimental-strip-types lib/pricing.check.ts
//
// Reproduces the client's own worked example from the money-flow sheets. If
// any of these fail, the site is quoting a different number than the business
// agreed to. No framework — assert only, same as types/artwork.check.ts.

import assert from "node:assert/strict";
import {
  aggregatorAdvanceOf,
  aggregatorCommissionOf,
  artistPriceFrom,
  artistSettlementOf,
  basePriceOf,
  checkoutTotal,
  displayPriceOf,
  exGst,
  gstIncludedIn,
  listingFeeOf,
  isPayoutDue,
  payoutReleaseDate,
  withGst,
  DELIVERY_CHARGE,
} from "./pricing.ts";

const ARTIST_PRICE = 100_000;

// --- Marketplace, exactly as the sheet works it -----------------------------

assert.equal(basePriceOf(ARTIST_PRICE), 130_000, "30% markup");
assert.equal(displayPriceOf(ARTIST_PRICE), 136_500, "GST inside the display price");
assert.equal(gstIncludedIn(136_500), 6_500, "GST portion of the display price");
assert.equal(exGst(136_500), 130_000, "stripping GST returns the base price");

const marketplace = checkoutTotal(displayPriceOf(ARTIST_PRICE));
assert.equal(marketplace.deliveryCharge, 2_500);
assert.equal(marketplace.convenienceFee, 0);
assert.equal(marketplace.total, 139_000, "customer pays 1,39,000");

// The bug this file exists to prevent: GST is inside the price, so adding it
// to the total charges the customer for it twice.
assert.equal(
  marketplace.total,
  marketplace.displayPrice + marketplace.deliveryCharge + marketplace.convenienceFee,
  "GST is never a line added to the total",
);

const artistOnMarketplace = artistSettlementOf(ARTIST_PRICE, "marketplace");
assert.equal(artistOnMarketplace.net, 100_000, "marketplace artist keeps the full price");
assert.equal(artistOnMarketplace.deliveryDeduction, 0);
assert.equal(artistOnMarketplace.convenienceDeduction, 0);

// GalleryZone's share: what the customer paid, less GST (goes to the
// government), less delivery (goes to the carrier), less the artist.
assert.equal(
  marketplace.total - marketplace.gstIncluded - marketplace.deliveryCharge - artistOnMarketplace.net,
  30_000,
  "GalleryZone keeps its 30% markup and nothing else",
);

// --- Aggregator, exactly as the sheet works it ------------------------------

// The aggregator's one uplift: 1,30,000 → 1,50,000 before tax.
const aggregatorDisplay = withGst(150_000);
assert.equal(aggregatorDisplay, 157_500, "aggregator display price with GST inside");

const aggregatorCheckout = checkoutTotal(aggregatorDisplay);
assert.equal(aggregatorCheckout.total, 160_000, "customer pays 1,60,000");
assert.equal(aggregatorCheckout.gstIncluded, 7_500);

assert.equal(aggregatorAdvanceOf(aggregatorDisplay), 7_875, "5% advance on the display price");
assert.equal(aggregatorAdvanceOf(150_000), 7_500, "5% advance on the sheet's pre-tax figure");

assert.equal(
  aggregatorCommissionOf(aggregatorDisplay, ARTIST_PRICE),
  10_000,
  "20% of (1,50,000 - 1,00,000)",
);
// An aggregator who never raises the price earns nothing, and never a negative.
assert.equal(aggregatorCommissionOf(displayPriceOf(ARTIST_PRICE), ARTIST_PRICE), 6_000);
assert.equal(aggregatorCommissionOf(withGst(90_000), ARTIST_PRICE), 0, "no negative commission");

const artistOnAggregator = artistSettlementOf(ARTIST_PRICE, "aggregator");
assert.equal(artistOnAggregator.deliveryDeduction, 2_500);
assert.equal(artistOnAggregator.convenienceDeduction, 2_000, "2% convenience");
assert.equal(artistOnAggregator.net, 95_500, "artist receives 95,500");

// Whole-flow balance: everything the customer and the aggregator put in has to
// come back out as GST, delivery, and the three parties' shares.
const aggregatorSettlement = 7_500 + DELIVERY_CHARGE + 10_000; // advance back + delivery back + commission
const moneyIn = aggregatorCheckout.total + 7_500 + DELIVERY_CHARGE;
const moneyOut =
  aggregatorCheckout.gstIncluded +
  aggregatorCheckout.deliveryCharge +
  artistOnAggregator.deliveryDeduction +
  aggregatorSettlement +
  artistOnAggregator.net;
assert.equal(moneyIn - moneyOut, 42_000, "GalleryZone keeps 42,000 on an aggregator sale");

// --- Working the ladder backwards -------------------------------------------

assert.equal(artistPriceFrom(136_500), 100_000, "display price back to artist price");
assert.equal(artistPriceFrom(displayPriceOf(23_400)), 23_400, "round trips");

// --- Listing fee -------------------------------------------------------------

assert.equal(listingFeeOf(ARTIST_PRICE), 0, "listing is free today");

// --- Payout timing -----------------------------------------------------------

const delivered = new Date("2026-08-01T00:00:00.000Z");
assert.equal(
  payoutReleaseDate(delivered).toISOString().slice(0, 10),
  "2026-08-08",
  "released 7 days after delivery",
);
assert.equal(isPayoutDue(delivered, new Date("2026-08-07T23:00:00.000Z").getTime()), false);
assert.equal(isPayoutDue(delivered, new Date("2026-08-08T01:00:00.000Z").getTime()), true);

console.log("lib/pricing.ts checks passed");
