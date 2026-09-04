// Run: node --experimental-strip-types packages/domain/src/pricing.check.ts
//
// Replays frontend-web/lib/pricing.check.ts's worked examples against this
// package's rates-parameterized functions and DEFAULT_RATE_SEED. If this
// file and the frontend's ever disagree, one of the two ports has drifted —
// exactly the class of bug that already happened once between
// frontend-web/lib/pricing.ts and mobile_flutter/lib/core/pricing.dart.

import assert from "node:assert/strict";
import {
  DEFAULT_RATE_SEED,
  aggregatorAdvanceForMonth,
  aggregatorCommissionOf,
  aggregatorOfferPriceOf,
  artistPriceFrom,
  artistSettlementOf,
  basePriceOf,
  billableWeightKg,
  canPlaceWithAnotherAggregator,
  checkoutTotal,
  deliveryZoneBetween,
  displayPriceOf,
  estimateDelivery,
  exGst,
  isPayoutDue,
  listingEndsAt,
  listingFeeOf,
  payoutReleaseDate,
  placementWindow,
} from "./pricing.ts";

const rates = DEFAULT_RATE_SEED;

// --- Marketplace worked example (artist price 1,00,000) --------------------
{
  const artistPrice = 100_000;
  const base = basePriceOf(artistPrice, rates);
  assert.equal(base, 130_000, "30% markup");
  const display = displayPriceOf(artistPrice, rates);
  assert.equal(display, 136_500, "GST inside display price");
  const checkout = checkoutTotal(display, rates);
  assert.equal(checkout.total, 139_000, "display + flat delivery");
  assert.equal(checkout.gstIncluded, 6_500);
  const settlement = artistSettlementOf(artistPrice, "marketplace", rates);
  assert.equal(settlement.net, 100_000, "marketplace pays artist in full");
  const galleryZoneKeeps = checkout.total - checkout.gstIncluded - checkout.deliveryCharge - settlement.net;
  assert.equal(galleryZoneKeeps, 30_000);
}

// --- Aggregator worked example (aggregator prices at 1,50,000 pre-tax) -----
{
  const artistPrice = 100_000;
  const aggregatorPreTax = 150_000;
  const display = 157_500; // withGst(150_000)
  const checkout = checkoutTotal(display, rates);
  assert.equal(checkout.total, 160_000);
  assert.equal(checkout.gstIncluded, 7_500);

  const commission = aggregatorCommissionOf(display, artistPrice, rates);
  assert.equal(commission, 10_000, "20% x (150,000 - 100,000)");

  const settlement = artistSettlementOf(artistPrice, "aggregator", rates);
  assert.equal(settlement.deliveryDeduction, 2_500);
  assert.equal(settlement.convenienceDeduction, 2_000);
  assert.equal(settlement.net, 95_500);

  assert.equal(aggregatorCommissionOf(displayPriceOfHelper(90_000, rates), artistPrice, rates), 0, "never negative");
}

function displayPriceOfHelper(preTax: number, r: typeof rates): number {
  return Math.round(preTax * (1 + r.gstRate));
}

// --- Ladder reversal & listing fee ------------------------------------------
{
  assert.equal(artistPriceFrom(136_500, rates), 100_000);
  assert.equal(artistPriceFrom(displayPriceOf(23_400, rates), rates), 23_400);
  assert.equal(listingFeeOf(100_000, rates), 0);
}

// --- Payout timing -----------------------------------------------------------
{
  const delivered = "2026-08-01T00:00:00.000Z";
  assert.equal(payoutReleaseDate(delivered, rates).toISOString(), "2026-08-08T00:00:00.000Z");
  assert.equal(isPayoutDue(delivered, rates, Date.parse("2026-08-07T23:00:00.000Z")), false);
  assert.equal(isPayoutDue(delivered, rates, Date.parse("2026-08-08T01:00:00.000Z")), true);
}

// --- GST isolation ------------------------------------------------------------
{
  assert.equal(exGst(157_500, rates) - 100_000, 50_000, "GST base excludes markup only, not commission math");
  const commission = aggregatorCommissionOf(157_500, 100_000, rates);
  assert.equal(commission, 10_000, "commission is untaxed: exactly 20% of 50,000");
  const settlement = artistSettlementOf(100_000, "aggregator", rates);
  assert.ok(!("gst" in settlement), "artist settlement carries no GST term at all");
}

// --- 5-month cycle offer prices ------------------------------------------------
{
  const artistPrice = 100_000;
  const expected = [130_000, 128_000, 126_000, 124_000, 122_000];
  for (let month = 1; month <= 5; month++) {
    assert.equal(aggregatorOfferPriceOf(artistPrice, month, rates), expected[month - 1]);
  }
  assert.equal(aggregatorOfferPriceOf(artistPrice, 6, rates), 122_000, "month 6 holds at month 5's rate");
  assert.equal(aggregatorOfferPriceOf(artistPrice, 9, rates), 122_000);
  assert.equal(displayPriceOf(artistPrice, rates), 136_500, "marketplace price never moves with the cycle");
}

// --- Advance by month ---------------------------------------------------------
{
  const month1 = aggregatorAdvanceForMonth({
    month: 1,
    displayPrice: 150_000,
    artistPrice: 100_000,
    rates,
  });
  assert.equal(month1.advance, 7_500);
  assert.equal(month1.basis, "display_price");
  assert.equal(month1.payable, 10_000);

  const month2Changed = aggregatorAdvanceForMonth({
    month: 2,
    displayPrice: 150_000,
    artistPrice: 100_000,
    rates,
    previousAggregatorChangedPrice: true,
  });
  assert.equal(month2Changed.advance, 5_000);

  const month2Unchanged = aggregatorAdvanceForMonth({
    month: 2,
    displayPrice: 150_000,
    artistPrice: 100_000,
    rates,
    previousAggregatorChangedPrice: false,
  });
  assert.equal(month2Unchanged.advance, 3_000);

  for (const month of [3, 4, 5]) {
    for (const changed of [true, false]) {
      const advance = aggregatorAdvanceForMonth({
        month,
        displayPrice: 150_000,
        artistPrice: 100_000,
        rates,
        previousAggregatorChangedPrice: changed,
      });
      assert.equal(advance.advance, 3_000, `month ${month} always 3%`);
    }
  }
}

// --- 180-day listing window ----------------------------------------------------
{
  const cycleStart = "2026-01-01T00:00:00.000Z";
  assert.equal(listingEndsAt(cycleStart, rates).toISOString(), "2026-06-30T00:00:00.000Z");

  const day0 = placementWindow({ cycleStartedAt: cycleStart, assignedAt: cycleStart, rates });
  assert.equal(day0.extended, false);

  const day130 = new Date("2026-01-01T00:00:00.000Z");
  day130.setDate(day130.getDate() + 130);
  const extended = placementWindow({ cycleStartedAt: cycleStart, assignedAt: day130, rates });
  assert.equal(extended.extended, true);

  const day120 = new Date("2026-01-01T00:00:00.000Z");
  day120.setDate(day120.getDate() + 120);
  const notExtended = placementWindow({ cycleStartedAt: cycleStart, assignedAt: day120, rates });
  assert.equal(notExtended.extended, false, "exactly 30 days left is not extended");

  const day160 = Date.parse(cycleStart) + 160 * 86_400_000;
  assert.equal(
    canPlaceWithAnotherAggregator({ cycleStartedAt: cycleStart, placementsSoFar: 3, rates, now: day160 }),
    false,
  );
  const day100 = Date.parse(cycleStart) + 100 * 86_400_000;
  assert.equal(
    canPlaceWithAnotherAggregator({ cycleStartedAt: cycleStart, placementsSoFar: 3, rates, now: day100 }),
    true,
  );
  assert.equal(
    canPlaceWithAnotherAggregator({ cycleStartedAt: cycleStart, placementsSoFar: 5, rates, now: day100 }),
    false,
  );
  assert.equal(
    canPlaceWithAnotherAggregator({ cycleStartedAt: null, placementsSoFar: 0, rates }),
    true,
  );
}

// --- Delivery -----------------------------------------------------------------
{
  assert.equal(
    billableWeightKg({ actualKg: 4, lengthCm: 100, breadthCm: 70, heightCm: 12 }),
    16.8,
    "volumetric wins",
  );
  assert.equal(
    billableWeightKg({ actualKg: 16.5, lengthCm: 45, breadthCm: 30, heightCm: 25 }),
    16.5,
    "actual wins",
  );
  assert.equal(billableWeightKg({ actualKg: 4 }), 4, "no dims => actual");

  assert.equal(deliveryZoneBetween("560001", "560078", rates), "local");
  assert.equal(deliveryZoneBetween("560001", "562159", rates), "regional");
  assert.equal(deliveryZoneBetween("560001", "500001", rates), "metro");
  assert.equal(deliveryZoneBetween("560001", "110001", rates), "national");
  assert.equal(deliveryZoneBetween("560001", "190001", rates), "remote");

  const near = estimateDelivery({ billableKg: 10, fromPincode: "560001", toPincode: "560078", rates });
  const far = estimateDelivery({ billableKg: 10, fromPincode: "560001", toPincode: "190001", rates });
  assert.ok(far.charge > near.charge, "farther costs more at same weight");

  const light = estimateDelivery({ billableKg: 5, fromPincode: "560001", toPincode: "110001", rates });
  const heavy = estimateDelivery({ billableKg: 20, fromPincode: "560001", toPincode: "110001", rates });
  assert.ok(heavy.charge > light.charge, "heavier costs more at same distance");

  const missing = estimateDelivery({ billableKg: null, fromPincode: null, toPincode: null, rates });
  assert.equal(missing.charge, rates.deliveryCharge);
  assert.equal(missing.estimated, false);
}

console.log("packages/domain/pricing.ts checks passed — matches frontend-web/lib/pricing.check.ts");
