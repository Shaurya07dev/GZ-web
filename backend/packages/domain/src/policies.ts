// Small pure policies that aren't strictly "pricing" but are exactly the
// kind of number the plan's "nothing hardcoded" rule covers — edit windows,
// penalty rates, withdrawal minimums, insurance/TDS thresholds. Kept in
// their own file rather than pricing.ts because they gate BEHAVIOR
// (can this artist edit? is this withdrawal allowed?) rather than compute a
// rupee figure, but they still take `rates` as a parameter for the same
// reason every pricing.ts function does.

import type { PricingRates } from "./pricing.ts";
import { addDays } from "./pricing.ts";
import type { ArtworkStatus } from "./state-machine.ts";

// Statuses past which an artist can no longer freely edit a listing, even
// if inside the day window — matches artistDashboardService's
// PURCHASE_LOCKED_STATUSES concept (the mock's own name for this set).
export const PURCHASE_LOCKED_ARTWORK_STATUSES: readonly ArtworkStatus[] = [
  "reserved",
  "with_aggregator",
  "sold",
  "settlement_complete",
  "delivered",
  "completed",
  "sold_externally",
];

export function editWindowExpiresAt(firstListedAt: string | Date, rates: PricingRates): Date {
  return addDays(firstListedAt, rates.artistEditWindowDays);
}

export function canEditArtwork({
  firstListedAt,
  status,
  rates,
  now = new Date(),
}: {
  firstListedAt: string | Date;
  status: ArtworkStatus;
  rates: PricingRates;
  now?: Date;
}): boolean {
  if (PURCHASE_LOCKED_ARTWORK_STATUSES.includes(status)) return false;
  return now.getTime() < editWindowExpiresAt(firstListedAt, rates).getTime();
}

// External-sale penalty (artistDashboardService.markSoldElsewhere) — a
// piece withdrawn from GalleryZone to sell elsewhere while still listed
// owes a fraction of the artist's own quoted price, not the display price
// (the artist never disclosed a display price for an off-platform sale).
export function externalSalePenaltyOf(artistPricePaise: number, rates: PricingRates): number {
  return Math.round(artistPricePaise * rates.externalSalePenaltyRate);
}

export function meetsMinWithdrawal(amountPaise: number, rates: PricingRates): boolean {
  return amountPaise >= rates.minWithdrawalPaise;
}

export function meetsMinCustomerWithdrawal(amountPaise: number, rates: PricingRates): boolean {
  return amountPaise >= rates.minCustomerWithdrawalPaise;
}

export function insuranceRecommended(artistPricePaise: number, rates: PricingRates): boolean {
  return artistPricePaise >= rates.insuranceThresholdPaise;
}

// Drives the admin-editable "earnings above 5L" flag's automatic side —
// types/admin.ts's earningsAbove5L is admin-toggleable, but this function
// is what a background job (Phase 2+) uses to suggest the flip rather than
// requiring an admin to notice on their own.
export function shouldFlagEarningsAbove5L(yearToDateEarningsPaise: number, rates: PricingRates): boolean {
  return yearToDateEarningsPaise >= rates.earningsAbove5LThresholdPaise;
}
