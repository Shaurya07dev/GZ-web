// Orchestrates the individual pricing.ts primitives (aggregatorOfferPriceOf,
// aggregatorAdvanceForMonth, placementWindow, canPlaceWithAnotherAggregator)
// into the one decision the "30-day/180-day window sweep" background job
// (plan.md §13) actually needs to make: given an artwork's placement
// history, what happens next? Still pure — the job (apps/jobs, Phase 2+)
// is what calls this on a schedule and turns the result into DB writes.

import {
  aggregatorAdvanceForMonth,
  aggregatorOfferPriceOf,
  canPlaceWithAnotherAggregator,
  placementWindow,
  withGst,
  type AggregatorAdvance,
  type PricingRates,
} from "./pricing.ts";

export interface HoldingHistoryEntry {
  aggregatorId: string;
  month: number;
  assignedAt: string | Date;
  returnedAt: string | Date | null;
  /** Did this aggregator use their one price change during their placement? */
  changedPrice: boolean;
}

export type AggregatorCycleOutcome =
  | { kind: "hold_with_current"; expiresAt: Date; extended: boolean }
  | { kind: "return_to_artist" }
  | {
      kind: "offer_to_next_aggregator";
      month: number;
      offerPricePaise: number;
      advance: AggregatorAdvance;
    };

/**
 * Called when a holding is returned unsold (or a placement window lapses).
 * Decides what happens to the artwork next: does it get placed with another
 * aggregator, does the current one keep it because there's no time left to
 * hand off, or does the whole cycle end and it goes home to the artist.
 */
export function decideNextAggregatorStep({
  artistPricePaise,
  cycleStartedAt,
  history,
  now = new Date(),
  rates,
}: {
  artistPricePaise: number;
  cycleStartedAt: string | Date;
  history: readonly HoldingHistoryEntry[];
  now?: Date;
  rates: PricingRates;
}): AggregatorCycleOutcome {
  const placementsSoFar = history.length;
  const canPlace = canPlaceWithAnotherAggregator({
    cycleStartedAt,
    placementsSoFar,
    rates,
    now: now.getTime(),
  });

  if (!canPlace) {
    // Either the 5-placement ceiling was hit, or too little of the 180-day
    // window is left to justify one more hand-off — either way the piece
    // goes home. (placementWindow's own "extended" case is handled by the
    // caller BEFORE returning a holding, not here — by the time we're
    // deciding the next step the current placement has already ended.)
    return { kind: "return_to_artist" };
  }

  const nextMonth = placementsSoFar + 1;
  const previous = history[history.length - 1];
  const offerPricePaise = aggregatorOfferPriceOf(artistPricePaise, nextMonth, rates);
  // Since 26 Aug 2026 aggregators can no longer set their own price (a
  // deliberate product change that contradicts the signed MOU's §6 "one
  // price change" clause — see the plan's reference to this), GalleryZone's
  // own offer price IS the effective display price. Month 1's advance basis
  // is therefore this offer, GST-applied, rather than an aggregator-chosen
  // figure — pricing.check.ts's worked example predates that product change
  // and used a hypothetical aggregator-set 1,50,000; this orchestration
  // reflects current product behavior, not that historical example.
  const advance = aggregatorAdvanceForMonth({
    month: nextMonth,
    displayPrice: withGst(offerPricePaise, rates),
    artistPrice: artistPricePaise,
    rates,
    previousAggregatorChangedPrice: previous?.changedPrice ?? false,
  });

  return {
    kind: "offer_to_next_aggregator",
    month: nextMonth,
    offerPricePaise,
    advance,
  };
}

