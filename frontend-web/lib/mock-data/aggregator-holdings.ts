import type { AggregatorHolding } from "@/types/aggregator";
import { isAggregatorListed } from "@/types/artwork";
import { mockArtworks } from "./artworks";

const TODAY = new Date("2026-08-11T00:00:00.000Z");

function daysFromToday(offset: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString();
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
