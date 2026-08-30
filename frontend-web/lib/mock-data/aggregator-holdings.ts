import type { AggregatorHolding } from "@/types/aggregator";
import { isAggregatorListed } from "@/types/artwork";
import { mockArtworks } from "./artworks";
import {
  artistPriceFrom,
  aggregatorOfferPriceOf,
  aggregatorAdvanceForMonth,
  withGst,
} from "../pricing";

const TODAY = new Date("2026-08-11T00:00:00.000Z");

function daysFromToday(offset: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString();
}

// For the two RESERVED demo holdings below (hold-13, hold-14) -- the only
// fixtures whose ExpiryCountdown actually renders (see holding-status.ts /
// collection-table.tsx: returned and sold holdings hide it). ExpiryCountdown
// now reads real Date.now(), not the fake TODAY anchor above, so these two
// need to be dated off the real clock too or the "comfortable window" /
// "urgent, 2 days left" demo states it's built to show land on the wrong day.
function realDaysFromToday(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString();
}

// Real pricing.ts math, not hand-picked numbers — so demo holdings show
// exactly the advance/rate/display price a live reservation at that month
// would actually produce (lib/pricing.ts, not lib/pricing.ts's own copy of
// itself: importing the pure functions directly here, never
// artistPayoutService, which pulls in mock-collections.ts and this file is
// one of mock-collections.ts's own imports).
function offerFor(
  customerPrice: number,
  month: number,
  previousAggregatorChangedPrice = false,
) {
  const artistPrice = artistPriceFrom(customerPrice);
  const displayPrice = withGst(aggregatorOfferPriceOf(artistPrice, month));
  const advance = aggregatorAdvanceForMonth({
    month,
    displayPrice,
    artistPrice,
    previousAggregatorChangedPrice,
  });
  return { displayPrice, advance };
}

// 6 holdings, mixed advancePercent (5% / 3%), expiresAt spread from "in 2
// days" to "in 25 days" so the Collection page's countdown/progress UI has
// both urgent and comfortable cases to render, one already
// sold_pending_settlement. advanceAmount = advancePercent% of the linked
// artwork's customerPrice (the only price this layer ever sees — see
// types/artwork.ts). displayPrice never sits below customerPrice, matching
// the SAD §2.7 floor constraint; two holdings show it raised above the
// floor to exercise the aggregator's "editable display price" feature.
//
// Every artworkId below must resolve to a real, currently-eligible
// marketplace_and_aggregator artwork in artworks.ts — enforced at module
// load below, not just by convention, since the Aggregator Portal track
// joins against this by id.
export const mockAggregatorHoldings: AggregatorHolding[] = [
  {
    id: "hold-1",
    artworkId: "ancestral-bronze-study",
    advancePercent: 5,
    advanceAmount: 6400,
    displayPrice: 128000,
    assignedAt: daysFromToday(-5),
    expiresAt: daysFromToday(25),
    status: "reserved",
    assignmentSource: "gz_assigned",
  },
  {
    id: "hold-2",
    artworkId: "balcony-seats-empty-reel",
    advancePercent: 3,
    advanceAmount: 492,
    displayPrice: 17200,
    assignedAt: daysFromToday(-18),
    expiresAt: daysFromToday(12),
    status: "reserved",
    assignmentSource: "self_reserved",
  },
  {
    id: "hold-3",
    artworkId: "college-street-folio",
    advancePercent: 5,
    advanceAmount: 710,
    displayPrice: 14200,
    assignedAt: daysFromToday(-24),
    expiresAt: daysFromToday(6),
    status: "reserved",
    assignmentSource: "gz_assigned",
  },
  {
    id: "hold-4",
    artworkId: "density-study-karol-bagh",
    advancePercent: 3,
    advanceAmount: 786,
    displayPrice: 28500,
    assignedAt: daysFromToday(-28),
    expiresAt: daysFromToday(2),
    status: "reserved",
    assignmentSource: "self_reserved",
  },
  {
    id: "hold-5",
    artworkId: "rust-and-ochre-wall-piece",
    advancePercent: 5,
    advanceAmount: 2900,
    displayPrice: 58000,
    assignedAt: daysFromToday(-12),
    expiresAt: daysFromToday(18),
    status: "reserved",
    assignmentSource: "gz_assigned",
  },
  {
    id: "hold-6",
    artworkId: "salvaged-frequencies",
    advancePercent: 3,
    advanceAmount: 1335,
    displayPrice: 44500,
    assignedAt: daysFromToday(-37),
    expiresAt: daysFromToday(-7),
    status: "sold_pending_settlement",
    assignmentSource: "self_reserved",
  },

  // --- Demo coverage for the reserve -> holding lifecycle (2026-08-29) ------
  //
  // hold-7/8: two RETURNED placements of the same artwork, so a live
  // reservation of it today computes to month 3 through the real
  // cycleMonthFor() count -- not a hand-set field -- which is what actually
  // exercises the price-ladder breakdown and the mid-progress CycleStepper on
  // the Reserve page and the browse grid. Also the first "returned" fixtures
  // ever seeded, so My Inventory's "Returned" status tab (and the holding
  // detail page's "your period has ended" state) has something to show.
  (() => {
    const price = offerFor(11600, 1);
    return {
      id: "hold-7",
      artworkId: "ghat-steps-no-7",
      advancePercent: price.advance.rate === 0.05 ? 5 : (3 as const),
      advanceAmount: price.advance.advance,
      deliveryDeposit: price.advance.deliveryCharge,
      cycleMonth: 1,
      displayPrice: price.displayPrice,
      assignedAt: daysFromToday(-70),
      expiresAt: daysFromToday(-40),
      returnedAt: daysFromToday(-40),
      status: "returned",
      assignmentSource: "self_reserved",
      displayPriceSetAt: null,
    } satisfies AggregatorHolding;
  })(),
  (() => {
    const price = offerFor(11600, 2);
    return {
      id: "hold-8",
      artworkId: "ghat-steps-no-7",
      advancePercent: price.advance.rate === 0.05 ? 5 : (3 as const),
      advanceAmount: price.advance.advance,
      deliveryDeposit: price.advance.deliveryCharge,
      cycleMonth: 2,
      displayPrice: price.displayPrice,
      assignedAt: daysFromToday(-38),
      expiresAt: daysFromToday(-8),
      returnedAt: daysFromToday(-8),
      status: "returned",
      assignmentSource: "gz_assigned",
      displayPriceSetAt: null,
    } satisfies AggregatorHolding;
  })(),

  // hold-9..12: four RETURNED placements of the same printmaking piece, so a
  // live reservation today lands on month 5 -- the last placement, deepest
  // price cut, full CycleStepper -- the edge of the five-month cycle this
  // whole feature is about.
  ...[1, 2, 3, 4].map((month, i) => {
    const price = offerFor(15600, month);
    const assignedOffset = [-100, -73, -46, -19][i]!;
    const returnedOffset = [-75, -48, -21, -2][i]!;
    return {
      id: `hold-${9 + i}`,
      artworkId: "letterpress-for-a-lost-street",
      advancePercent: price.advance.rate === 0.05 ? 5 : (3 as const),
      advanceAmount: price.advance.advance,
      deliveryDeposit: price.advance.deliveryCharge,
      cycleMonth: month,
      displayPrice: price.displayPrice,
      assignedAt: daysFromToday(assignedOffset),
      expiresAt: daysFromToday(returnedOffset),
      returnedAt: daysFromToday(returnedOffset),
      status: "returned",
      assignmentSource: i % 2 === 0 ? "self_reserved" : "gz_assigned",
      displayPriceSetAt: null,
    } satisfies AggregatorHolding;
  }),

  // hold-13: currently RESERVED, mid-cycle (month 3) -- the everyday "you have
  // this piece right now" state: countdown, COA/NFC passport visible, stepper
  // lit through month 3.
  (() => {
    const price = offerFor(18200, 3);
    return {
      id: "hold-13",
      artworkId: "platform-nine-first-light",
      advancePercent: price.advance.rate === 0.05 ? 5 : (3 as const),
      advanceAmount: price.advance.advance,
      deliveryDeposit: price.advance.deliveryCharge,
      cycleMonth: 3,
      displayPrice: price.displayPrice,
      assignedAt: realDaysFromToday(-10),
      expiresAt: realDaysFromToday(20),
      status: "reserved",
      assignmentSource: "self_reserved",
      displayPriceSetAt: null,
      returnedAt: null,
    } satisfies AggregatorHolding;
  })(),

  // hold-14: currently RESERVED, month 5, expiring in 2 days -- the urgent
  // countdown state (ExpiryCountdown turns red at <=3 days left) at the same
  // time as the deepest cycle discount.
  (() => {
    const price = offerFor(47800, 5);
    return {
      id: "hold-14",
      artworkId: "signal-loss-diptych",
      advancePercent: price.advance.rate === 0.05 ? 5 : (3 as const),
      advanceAmount: price.advance.advance,
      deliveryDeposit: price.advance.deliveryCharge,
      cycleMonth: 5,
      displayPrice: price.displayPrice,
      assignedAt: realDaysFromToday(-28),
      expiresAt: realDaysFromToday(2),
      windowExtended: true,
      status: "reserved",
      assignmentSource: "gz_assigned",
      displayPriceSetAt: null,
      returnedAt: null,
    } satisfies AggregatorHolding;
  })(),

  // hold-15: SOLD, pending settlement, at month 2 with the 5% (not 3%) branch
  // exercised -- the "previous aggregator changed price" variant of the
  // month-2 rate -- so the fixtures cover both month-2 outcomes, not just one.
  (() => {
    const price = offerFor(96200, 2, true);
    return {
      id: "hold-15",
      artworkId: "noon-heat-chettinad",
      advancePercent: price.advance.rate === 0.05 ? 5 : (3 as const),
      advanceAmount: price.advance.advance,
      deliveryDeposit: price.advance.deliveryCharge,
      cycleMonth: 2,
      displayPrice: price.displayPrice,
      assignedAt: daysFromToday(-45),
      expiresAt: daysFromToday(-15),
      status: "sold_pending_settlement",
      assignmentSource: "self_reserved",
      displayPriceSetAt: null,
      returnedAt: null,
    } satisfies AggregatorHolding;
  })(),
];

// Self-check: fail fast (at import time) rather than let the two fixtures
// silently drift out of sync.
for (const holding of mockAggregatorHoldings) {
  const artwork = mockArtworks.find((a) => a.id === holding.artworkId);
  if (!artwork) {
    throw new Error(
      `mock-data/aggregator-holdings: "${holding.artworkId}" does not exist in mockArtworks`,
    );
  }
  if (!isAggregatorListed(artwork.listingType)) {
    throw new Error(
      `mock-data/aggregator-holdings: "${holding.artworkId}" must be listed on the aggregator channel (got "${artwork.listingType}")`,
    );
  }
}
