// Run: node --experimental-strip-types lib/pricing.check.ts
//
// Reproduces the client's own worked example from the money-flow sheets. If
// any of these fail, the site is quoting a different number than the business
// agreed to. No framework — assert only, same as types/artwork.check.ts.

import assert from "node:assert/strict";
import {
  aggregatorAdvanceForMonth,
  aggregatorAdvanceOf,
  aggregatorOfferPriceOf,
  billableWeightKg,
  canPlaceWithAnotherAggregator,
  daysLeftInListing,
  listingEndsAt,
  placementWindow,
  deliveryZoneBetween,
  estimateDelivery,
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

// --- GST is charged on the goods and on nothing else -------------------------
//
// Client, 25 Aug: "GST is always charged on total price of good and is not
// charged anywhere else. So it will be on final customer price. That is as per
// example 1,50,000."

// The tax in the aggregator order is exactly 5% of 1,50,000 — the artwork — and
// not a rupee more, even though the customer pays 1,60,000 in total.
assert.equal(aggregatorCheckout.gstIncluded, 7_500, "GST is 5% of the artwork price");
assert.equal(
  aggregatorCheckout.gstIncluded,
  Math.round(150_000 * 0.05),
  "the GST base is the artwork price, not the order total",
);

// Delivery is never taxed: adding it must not move the tax figure at all.
assert.equal(
  checkoutTotal(aggregatorDisplay).gstIncluded,
  gstIncludedIn(aggregatorDisplay),
  "delivery is outside the GST base",
);
assert.ok(
  aggregatorCheckout.gstIncluded < Math.round(aggregatorCheckout.total * 0.05),
  "taxing the whole order total would be more than taxing the artwork alone",
);

// Commission is not taxed either — 20% of the markup, with nothing added.
assert.equal(
  aggregatorCommissionOf(aggregatorDisplay, ARTIST_PRICE),
  Math.round(50_000 * 0.2),
  "commission carries no GST of its own",
);

// And the artist's settlement is a plain deduction, never a tax calculation.
assert.equal(
  artistOnAggregator.net,
  ARTIST_PRICE - artistOnAggregator.deliveryDeduction - artistOnAggregator.convenienceDeduction,
  "no GST anywhere in the artist's settlement",
);

// --- The five-month aggregator cycle ----------------------------------------

// The price offered to each month's aggregator, straight off the sheet.
assert.deepEqual(
  [1, 2, 3, 4, 5].map((month) => aggregatorOfferPriceOf(ARTIST_PRICE, month)),
  [130_000, 128_000, 126_000, 124_000, 122_000],
  "offer price falls 2/4/6/8% of the artist price",
);

// Month 6 is the transit buffer. If it is ever used it holds at month 5.
assert.equal(aggregatorOfferPriceOf(ARTIST_PRICE, 6), 122_000);
assert.equal(aggregatorOfferPriceOf(ARTIST_PRICE, 9), 122_000);

// The reduction comes out of GalleryZone's margin, never the artist's price,
// and never touches what the marketplace shows.
assert.equal(displayPriceOf(ARTIST_PRICE), 136_500, "marketplace price does not move");
assert.equal(
  aggregatorOfferPriceOf(ARTIST_PRICE, 5) - ARTIST_PRICE,
  22_000,
  "GalleryZone's margin absorbs the whole reduction",
);

// Advance, month by month. Month 1 is charged on the display price the
// aggregator sets; every later month on the artist price.
const monthOne = aggregatorAdvanceForMonth({
  month: 1,
  displayPrice: 150_000,
  artistPrice: ARTIST_PRICE,
});
assert.equal(monthOne.advance, 7_500, "month 1: 5% of 1,50,000");
assert.equal(monthOne.basis, "display_price");
assert.equal(monthOne.payable, 7_500 + DELIVERY_CHARGE, "advance plus delivery");

// Month 2 keeps 5% only when the previous aggregator used their price change.
const monthTwoChanged = aggregatorAdvanceForMonth({
  month: 2,
  displayPrice: 150_000,
  artistPrice: ARTIST_PRICE,
  previousAggregatorChangedPrice: true,
});
assert.equal(monthTwoChanged.advance, 5_000, "month 2 after a price change: 5% of 1,00,000");
assert.equal(monthTwoChanged.basis, "artist_price");

const monthTwoUnchanged = aggregatorAdvanceForMonth({
  month: 2,
  displayPrice: 150_000,
  artistPrice: ARTIST_PRICE,
  previousAggregatorChangedPrice: false,
});
assert.equal(monthTwoUnchanged.advance, 3_000, "month 2 with no price change: 3%");

// Months 3-5 are 3% of the artist price regardless of what anyone did.
for (const month of [3, 4, 5]) {
  for (const changed of [true, false]) {
    assert.equal(
      aggregatorAdvanceForMonth({
        month,
        displayPrice: 150_000,
        artistPrice: ARTIST_PRICE,
        previousAggregatorChangedPrice: changed,
      }).advance,
      3_000,
      `month ${month} is always 3% of the artist price`,
    );
  }
}

// --- The 180-day listing, and who keeps the leftover -------------------------
//
// Client, 25 Aug: "if 160 days went in 5 months with aggregator then for the
// remaining 20 days it will not go for more aggregator — the art will extend
// its time with the last aggregator itself. And then sent back to artist upon
// its 180 days completion."

const CYCLE_START = "2026-01-01T00:00:00.000Z";
const day = (n: number) => new Date(Date.parse(CYCLE_START) + n * 86_400_000);

assert.equal(
  listingEndsAt(CYCLE_START).toISOString().slice(0, 10),
  "2026-06-30",
  "the listing runs 180 days from the first placement",
);

// A placement that starts with plenty of room ends after its own thirty days.
const early = placementWindow({ cycleStartedAt: CYCLE_START, assignedAt: day(0) });
assert.equal(early.expiresAt.toISOString().slice(0, 10), "2026-01-31");
assert.equal(early.extended, false);

// The client's own case: a placement beginning on day 130 would naturally end
// on day 160, leaving 20 days — too short for anyone else, so this aggregator
// keeps the piece all the way to day 180 instead.
const last = placementWindow({ cycleStartedAt: CYCLE_START, assignedAt: day(130) });
assert.equal(
  last.expiresAt.toISOString().slice(0, 10),
  listingEndsAt(CYCLE_START).toISOString().slice(0, 10),
  "the last aggregator absorbs the leftover rather than the piece moving again",
);
assert.equal(last.extended, true);

// Exactly thirty days left is still a real placement, not a stub.
const exact = placementWindow({ cycleStartedAt: CYCLE_START, assignedAt: day(120) });
assert.equal(exact.extended, false, "a full thirty days is not a leftover");

// Nobody new takes a piece with under thirty days on the clock.
assert.equal(
  canPlaceWithAnotherAggregator({
    cycleStartedAt: CYCLE_START,
    placementsSoFar: 3,
    now: day(160).getTime(),
  }),
  false,
  "20 days left: no new aggregator",
);
assert.equal(
  canPlaceWithAnotherAggregator({
    cycleStartedAt: CYCLE_START,
    placementsSoFar: 3,
    now: day(100).getTime(),
  }),
  true,
);
// Five placements is the ceiling even with time to spare.
assert.equal(
  canPlaceWithAnotherAggregator({
    cycleStartedAt: CYCLE_START,
    placementsSoFar: 5,
    now: day(10).getTime(),
  }),
  false,
  "five aggregators maximum",
);
// A piece nobody has taken yet has not started its clock.
assert.equal(
  canPlaceWithAnotherAggregator({ cycleStartedAt: null, placementsSoFar: 0 }),
  true,
);
assert.equal(daysLeftInListing(CYCLE_START, day(160).getTime()), 20);
assert.equal(daysLeftInListing(CYCLE_START, day(200).getTime()), 0, "never negative");

// --- Delivery ----------------------------------------------------------------

// Volumetric weight governs: a 4kg framed canvas in a 100x70x12cm box.
assert.equal(
  billableWeightKg({ actualKg: 4, lengthCm: 100, breadthCm: 70, heightCm: 12 }),
  16.8,
  "volumetric weight beats actual weight",
);
// A dense, small piece bills on its real weight instead.
assert.equal(
  billableWeightKg({ actualKg: 16.5, lengthCm: 45, breadthCm: 30, heightCm: 25 }),
  16.5,
);
// No dimensions recorded — fall back to what the artist entered.
assert.equal(billableWeightKg({ actualKg: 4 }), 4);

// Distance matters as much as weight: the same parcel across the country costs
// more than the same parcel across town.
assert.equal(deliveryZoneBetween("560001", "560078"), "local");
assert.equal(deliveryZoneBetween("560001", "562159"), "regional");
assert.equal(deliveryZoneBetween("560001", "500001"), "metro");
assert.equal(deliveryZoneBetween("560001", "110001"), "national");
assert.equal(deliveryZoneBetween("560001", "190001"), "remote");

const nearby = estimateDelivery({ billableKg: 16.8, fromPincode: "560001", toPincode: "560078" });
const faraway = estimateDelivery({ billableKg: 16.8, fromPincode: "560001", toPincode: "110001" });
assert.equal(nearby.zone, "local");
assert.ok(faraway.charge > nearby.charge, "the same parcel costs more further away");
assert.ok(nearby.estimated && faraway.estimated);

const heavier = estimateDelivery({ billableKg: 34.6, fromPincode: "560001", toPincode: "110001" });
assert.ok(heavier.charge > faraway.charge, "a bigger box costs more over the same distance");

// Not enough to go on: fall back to the flat charge and say so.
const unknown = estimateDelivery({ billableKg: 16.8, fromPincode: "560001", toPincode: null });
assert.equal(unknown.charge, DELIVERY_CHARGE);
assert.equal(unknown.estimated, false);

console.log("lib/pricing.ts checks passed");
