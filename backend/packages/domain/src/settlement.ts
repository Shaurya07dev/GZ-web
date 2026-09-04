// Ledger posting construction — plan.md §9 (Money flows), rebuilt against
// the actual pricing.ts numbers rather than plan.md's superseded formulas
// (see that section's own note in the plan). Every function here returns a
// set of postings whose amounts sum to exactly zero — that invariant is
// what packages/db's ledger_entries table + DB trigger enforce at write
// time, and what settlement.check.ts's property test verifies here first,
// pre-write, so a bug is caught in a unit test rather than a failed insert.
//
// Pure, zero I/O: these functions never touch a database. packages/db's
// repository layer is what turns a Posting[] into ledger_entries rows
// inside one DB transaction, tagged with a shared transactionId.

import {
  aggregatorAdvanceOf,
  aggregatorCommissionOf,
  artistSettlementOf,
  checkoutTotal,
  exGst,
  type PricingRates,
} from "./pricing.ts";

export type LedgerAccountType =
  | "artist_payable"
  | "aggregator_payable"
  | "customer_wallet"
  | "platform_revenue"
  | "razorpay_escrow"
  | "gst_payable"
  | "tds_payable";

export interface Posting {
  accountType: LedgerAccountType;
  /** Whose account, e.g. an artist's userId — omitted for a system account. */
  ownerId?: string;
  amountPaise: number;
  reason: string;
}

function assertBalanced(postings: Posting[], label: string): Posting[] {
  const sum = postings.reduce((total, p) => total + p.amountPaise, 0);
  if (sum !== 0) {
    throw new Error(`${label}: postings do not sum to zero (got ${sum})`);
  }
  return postings;
}

// --- Marketplace checkout -----------------------------------------------------
//
// Money in: the full checkout total, captured into Razorpay Route escrow.
// Money out, immediately recognized: GST payable (statutory liability, not
// GalleryZone's revenue) and the artist's payable (released later by the
// 7-day-post-delivery job — see artistPayoutJob below — this posting is
// when the LIABILITY is recognized, not when cash actually reaches the
// artist's bank account, which is a separate RazorpayX payout event).
// What's left in escrow after GST + artist payable is GalleryZone's margin.
export function marketplaceCheckoutPostings({
  artistId,
  artistPricePaise,
  rates,
}: {
  artistId: string;
  artistPricePaise: number;
  rates: PricingRates;
}): Posting[] {
  const displayPrice = Math.round(artistPricePaise * (1 + rates.platformMarkup) * (1 + rates.gstRate));
  const checkout = checkoutTotal(displayPrice, rates);
  const settlement = artistSettlementOf(artistPricePaise, "marketplace", rates);
  // Residual, same reasoning as aggregatorSalePostings below: balances by
  // construction, and also carries the delivery-courier pass-through
  // (checkout.deliveryCharge is customer-paid, not artist-deducted, on
  // marketplace sales, but GalleryZone still owes it to the courier).
  const platformResidual = checkout.total - checkout.gstIncluded - settlement.net;

  return assertBalanced(
    [
      { accountType: "razorpay_escrow", amountPaise: checkout.total, reason: "checkout_capture" },
      { accountType: "gst_payable", amountPaise: -checkout.gstIncluded, reason: "gst_liability" },
      { accountType: "artist_payable", ownerId: artistId, amountPaise: -settlement.net, reason: "marketplace_settlement" },
      { accountType: "platform_revenue", amountPaise: -platformResidual, reason: "margin_and_delivery_passthrough" },
    ],
    "marketplaceCheckoutPostings",
  );
}

// --- Aggregator sale ------------------------------------------------------------
//
// Two money events, kept separate because they can land on different days:
// (1) the advance was already captured into escrow at reservation time
// (aggregatorAdvancePostings, below) — recordSale() does NOT re-capture it;
// (2) the sale itself, which recognizes the artist payable, the aggregator's
// commission payable, and releases GalleryZone's margin, while returning
// the advance liability to zero (the advance was a deposit against this
// exact sale).
export function aggregatorSalePostings({
  artistId,
  aggregatorId,
  displayPricePaise,
  artistPricePaise,
  advanceAlreadyHeldPaise,
  rates,
}: {
  artistId: string;
  aggregatorId: string;
  displayPricePaise: number;
  artistPricePaise: number;
  advanceAlreadyHeldPaise: number;
  rates: PricingRates;
}): Posting[] {
  const gstIncluded = displayPricePaise - exGst(displayPricePaise, rates);
  const settlement = artistSettlementOf(artistPricePaise, "aggregator", rates);
  const commission = aggregatorCommissionOf(displayPricePaise, artistPricePaise, rates);

  // platform_revenue is the RESIDUAL of the capture — displayPrice minus
  // every other named leg — rather than a separately-derived figure. This
  // is deliberate: computing it as a residual makes the postings balance
  // by construction, immune to any rounding drift between this function
  // and pricing.ts's own rounding. Note this residual also carries the
  // delivery-courier pass-through (settlement.deliveryDeduction was
  // deducted from the artist but must still be paid to a real courier) —
  // it is not GalleryZone's true kept margin on its own; the worked
  // example's "GalleryZone keeps 42,000" figure is this residual MINUS
  // settlement.deliveryDeduction, a reporting-time calculation, not a
  // separate ledger account (this scaffold has no dedicated
  // courier_payable account type yet — Phase 2 can split it out once the
  // real Shiprocket/courier billing integration exists).
  const platformResidual = displayPricePaise - gstIncluded - settlement.net - commission;

  return assertBalanced(
    [
      // The advance held in escrow since reservation is released back out —
      // it isn't new money, so this leg is a wash against the postings
      // aggregatorAdvancePostings already made.
      { accountType: "razorpay_escrow", amountPaise: -advanceAlreadyHeldPaise, reason: "advance_applied_to_sale" },
      { accountType: "aggregator_payable", ownerId: aggregatorId, amountPaise: advanceAlreadyHeldPaise, reason: "advance_released" },
      { accountType: "razorpay_escrow", amountPaise: displayPricePaise, reason: "aggregator_sale_capture" },
      { accountType: "gst_payable", amountPaise: -gstIncluded, reason: "gst_liability" },
      { accountType: "artist_payable", ownerId: artistId, amountPaise: -settlement.net, reason: "aggregator_settlement" },
      { accountType: "aggregator_payable", ownerId: aggregatorId, amountPaise: -commission, reason: "aggregator_commission" },
      { accountType: "platform_revenue", amountPaise: -platformResidual, reason: "margin_and_delivery_passthrough" },
    ],
    "aggregatorSalePostings",
  );
}

// --- Aggregator advance (captured at reservation, before any sale) ------------

export function aggregatorAdvancePostings({
  aggregatorId,
  displayPricePaise,
  rates,
}: {
  aggregatorId: string;
  displayPricePaise: number;
  rates: PricingRates;
}): Posting[] {
  const advance = aggregatorAdvanceOf(displayPricePaise, rates);
  return assertBalanced(
    [
      { accountType: "razorpay_escrow", amountPaise: advance, reason: "aggregator_advance_capture" },
      { accountType: "aggregator_payable", ownerId: aggregatorId, amountPaise: -advance, reason: "advance_liability" },
    ],
    "aggregatorAdvancePostings",
  );
}

// --- Unsold return: advance refunded, delivery forfeited (per the mock's own rule) --

export function aggregatorReturnPostings({
  aggregatorId,
  advancePaise,
}: {
  aggregatorId: string;
  advancePaise: number;
}): Posting[] {
  return assertBalanced(
    [
      { accountType: "aggregator_payable", ownerId: aggregatorId, amountPaise: advancePaise, reason: "advance_refund_liability" },
      { accountType: "razorpay_escrow", amountPaise: -advancePaise, reason: "advance_refund_capture" },
    ],
    "aggregatorReturnPostings",
  );
}

// --- Withdrawal payout (RazorpayX) — discharges a payable once cash actually leaves --
//
// The payable was originally recognized as a negative posting on the
// owner's account (see e.g. artist_payable: -settlement.net above) — that
// negative IS the liability. Paying it out extinguishes the liability
// (posted back to zero, i.e. +amountPaise here) at the same moment the
// backing cash leaves escrow (-amountPaise) — the two exactly cancel,
// because escrow was always what the payable was a claim against. No third
// "revenue" leg is needed: this transaction doesn't create or destroy
// value, it just discharges a claim against cash that was already earmarked
// for it.
export function withdrawalPayoutPostings({
  accountType,
  ownerId,
  amountPaise,
}: {
  accountType: Extract<LedgerAccountType, "artist_payable" | "aggregator_payable" | "customer_wallet">;
  ownerId: string;
  amountPaise: number;
}): Posting[] {
  return assertBalanced(
    [
      { accountType, ownerId, amountPaise, reason: "payable_discharged" },
      { accountType: "razorpay_escrow", amountPaise: -amountPaise, reason: "razorpayx_payout" },
    ],
    "withdrawalPayoutPostings",
  );
}
