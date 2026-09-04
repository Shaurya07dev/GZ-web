// Every rupee figure in GalleryZone comes from here — ported function-for-
// function from frontend-web/lib/pricing.ts (see that file's header for the
// full worked example and the business context behind each rule).
//
// The one structural difference from the frontend copy: nothing here is a
// module-level constant. Every function takes a `PricingRates` object as its
// first (or only extra) argument. That object is resolved by
// packages/config from the versioned `rate_config` table — never hardcoded
// in application code — so a rate change is a DB write plus an admin
// approval (see the plan's "Admin rules console" section), not a deploy.
//
// packages/domain/src/pricing.check.ts replays every worked example from
// frontend-web/lib/pricing.check.ts against DEFAULT_RATE_SEED below and
// fails loudly if anything drifts from the client's numbers.

export interface DeliveryZoneRate {
  base: number;
  perExtraKg: number;
}

export type DeliveryZone = "local" | "regional" | "metro" | "national" | "remote";

export interface PricingRates {
  /** HSN 9701. Confirmed by the client (25 Aug 2026): 5%, not the 2025-era 12%. */
  gstRate: number;
  /** GalleryZone's margin over the artist's price, before GST. */
  platformMarkup: number;
  /** Free to list today; kept as a rate so switching it on is a value change. */
  artistListingFeeRate: number;
  /** Aggregator MOU §7 — security deposit paid before taking possession. */
  aggregatorAdvanceRate: number;
  /** Aggregator MOU §8 — 20% of (selling price − artist price). */
  aggregatorCommissionRate: number;
  /** Deducted from the artist's settlement on aggregator sales only. */
  artistConvenienceRate: number;
  /** Charged to the customer at checkout. Zero during the launch period. */
  customerConvenienceFee: number;
  /** Flat fallback delivery charge when weight/pincode data is missing. */
  deliveryCharge: number;
  /** Days after delivery before the artist's settlement is released. */
  artistPayoutDaysAfterDelivery: number;
  /** How many aggregators a piece can rotate through in one listing cycle. */
  aggregatorCycleMonths: number;
  /** Artist MOU §18 — whole listing window, in days. */
  aggregatorListingDays: number;
  /** One aggregator's display window, in days. */
  aggregatorPlacementDays: number;
  /** Percent-off-artist-price ladder applied to the next aggregator's offer, index 0 = month 1. */
  aggregatorMonthlyDiscountRates: readonly number[];
  /** Rate card per delivery zone. */
  deliveryZoneRates: Record<DeliveryZone, DeliveryZoneRate>;
  /** Base weight slab (kg) included in a zone's base rate. */
  deliveryBaseSlabKg: number;
  /** Pincode 2-digit prefixes billed at the "remote" zone rate (J&K/HP/NE). */
  remotePincodePrefixes: readonly string[];
}

// Seed values for the `rate_config` table's first migration only. Not
// imported by any pricing function above — every function takes `rates`
// explicitly, so this object is data, not logic. Values match the client's
// "How the money flows" sheet (21 Aug 2026), confirmed 25 Aug 2026, and
// frontend-web/lib/pricing.ts's current constants exactly.
export const DEFAULT_RATE_SEED: PricingRates = {
  gstRate: 0.05,
  platformMarkup: 0.3,
  artistListingFeeRate: 0,
  aggregatorAdvanceRate: 0.05,
  aggregatorCommissionRate: 0.2,
  artistConvenienceRate: 0.02,
  customerConvenienceFee: 0,
  deliveryCharge: 2500,
  artistPayoutDaysAfterDelivery: 7,
  aggregatorCycleMonths: 5,
  aggregatorListingDays: 180,
  aggregatorPlacementDays: 30,
  aggregatorMonthlyDiscountRates: [0, 0.02, 0.04, 0.06, 0.08],
  deliveryZoneRates: {
    local: { base: 400, perExtraKg: 55 },
    regional: { base: 620, perExtraKg: 80 },
    metro: { base: 780, perExtraKg: 95 },
    national: { base: 950, perExtraKg: 120 },
    remote: { base: 1400, perExtraKg: 175 },
  },
  deliveryBaseSlabKg: 5,
  remotePincodePrefixes: ["18", "19", "78", "79"],
};

export const DELIVERY_ZONE_LABEL: Record<DeliveryZone, string> = {
  local: "Same city",
  regional: "Nearby",
  metro: "Same region",
  national: "Rest of India",
  remote: "Remote area",
};

// --- Price ladder -----------------------------------------------------------

/** Artist's price → GalleryZone's price before GST. 1,00,000 → 1,30,000. */
export function basePriceOf(artistPrice: number, rates: PricingRates): number {
  return Math.round(artistPrice * (1 + rates.platformMarkup));
}

/** Artist's price → the number shown on the site, GST included. */
export function displayPriceOf(artistPrice: number, rates: PricingRates): number {
  return withGst(basePriceOf(artistPrice, rates), rates);
}

/** Adds GST to a pre-tax figure. 1,30,000 → 1,36,500. */
export function withGst(preTax: number, rates: PricingRates): number {
  return Math.round(preTax * (1 + rates.gstRate));
}

/** Strips GST back out of a displayed price. 1,36,500 → 1,30,000. */
export function exGst(displayPrice: number, rates: PricingRates): number {
  return Math.round(displayPrice / (1 + rates.gstRate));
}

/** The GST already contained in a displayed price. 1,36,500 → 6,500. */
export function gstIncludedIn(displayPrice: number, rates: PricingRates): number {
  return displayPrice - exGst(displayPrice, rates);
}

/** Works the ladder backwards — displayed price → the artist price behind it. */
export function artistPriceFrom(displayPrice: number, rates: PricingRates): number {
  return Math.round(exGst(displayPrice, rates) / (1 + rates.platformMarkup));
}

/** The listing fee an artist owes for putting a piece up. ₹0 today. */
export function listingFeeOf(artistPrice: number, rates: PricingRates): number {
  return Math.round(artistPrice * rates.artistListingFeeRate);
}

// --- Checkout ---------------------------------------------------------------

export interface CheckoutTotal {
  displayPrice: number;
  gstIncluded: number;
  deliveryCharge: number;
  convenienceFee: number;
  total: number;
}

// Never add gstIncluded to the total — it is already part of displayPrice.
export function checkoutTotal(displayPrice: number, rates: PricingRates): CheckoutTotal {
  return {
    displayPrice,
    gstIncluded: gstIncludedIn(displayPrice, rates),
    deliveryCharge: rates.deliveryCharge,
    convenienceFee: rates.customerConvenienceFee,
    total: displayPrice + rates.deliveryCharge + rates.customerConvenienceFee,
  };
}

// --- Settlements ------------------------------------------------------------

export type SaleChannel = "marketplace" | "aggregator";

export interface ArtistSettlement {
  gross: number;
  deliveryDeduction: number;
  convenienceDeduction: number;
  net: number;
}

export function artistSettlementOf(
  artistPrice: number,
  channel: SaleChannel,
  rates: PricingRates,
): ArtistSettlement {
  if (channel === "marketplace") {
    return { gross: artistPrice, deliveryDeduction: 0, convenienceDeduction: 0, net: artistPrice };
  }
  const convenienceDeduction = Math.round(artistPrice * rates.artistConvenienceRate);
  return {
    gross: artistPrice,
    deliveryDeduction: rates.deliveryCharge,
    convenienceDeduction,
    net: artistPrice - rates.deliveryCharge - convenienceDeduction,
  };
}

/** Aggregator MOU §8. Both prices compared before GST. */
export function aggregatorCommissionOf(
  displayPrice: number,
  artistPrice: number,
  rates: PricingRates,
): number {
  const markup = Math.max(0, exGst(displayPrice, rates) - artistPrice);
  return Math.round(markup * rates.aggregatorCommissionRate);
}

/** Aggregator MOU §7 — a rate of the price the piece is being displayed at. */
export function aggregatorAdvanceOf(displayPrice: number, rates: PricingRates): number {
  return Math.round(displayPrice * rates.aggregatorAdvanceRate);
}

// --- The aggregator cycle ---------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(from: string | Date, days: number): Date {
  return new Date(new Date(from).getTime() + days * DAY_MS);
}

export function listingEndsAt(cycleStartedAt: string | Date, rates: PricingRates): Date {
  return addDays(cycleStartedAt, rates.aggregatorListingDays);
}

export function daysLeftInListing(
  cycleStartedAt: string | Date,
  rates: PricingRates,
  now: number = Date.now(),
): number {
  return Math.max(0, Math.ceil((listingEndsAt(cycleStartedAt, rates).getTime() - now) / DAY_MS));
}

export function canPlaceWithAnotherAggregator({
  cycleStartedAt,
  placementsSoFar,
  rates,
  now = Date.now(),
}: {
  cycleStartedAt: string | Date | null;
  placementsSoFar: number;
  rates: PricingRates;
  now?: number;
}): boolean {
  if (cycleStartedAt === null) return true;
  if (placementsSoFar >= rates.aggregatorCycleMonths) return false;
  return daysLeftInListing(cycleStartedAt, rates, now) >= rates.aggregatorPlacementDays;
}

export interface PlacementWindow {
  expiresAt: Date;
  extended: boolean;
}

export function placementWindow({
  cycleStartedAt,
  assignedAt,
  rates,
}: {
  cycleStartedAt: string | Date;
  assignedAt: string | Date;
  rates: PricingRates;
}): PlacementWindow {
  const listingEnd = listingEndsAt(cycleStartedAt, rates);
  const naturalEnd = addDays(assignedAt, rates.aggregatorPlacementDays);
  const leftover = listingEnd.getTime() - naturalEnd.getTime();

  if (leftover < rates.aggregatorPlacementDays * DAY_MS) {
    return { expiresAt: listingEnd, extended: leftover > 0 };
  }
  return { expiresAt: naturalEnd, extended: false };
}

/** Clamps a cycle month into the configured table. Month past the end holds at the last rate. */
function cycleIndex(month: number, rates: PricingRates): number {
  if (month < 1) return 0;
  return Math.min(month, rates.aggregatorCycleMonths) - 1;
}

export function aggregatorDiscountRateOf(month: number, rates: PricingRates): number {
  const rate = rates.aggregatorMonthlyDiscountRates[cycleIndex(month, rates)];
  if (rate === undefined) {
    throw new Error(
      `aggregatorMonthlyDiscountRates has no entry for cycle index ${cycleIndex(month, rates)}`,
    );
  }
  return rate;
}

export function aggregatorOfferPriceOf(
  artistPrice: number,
  month: number,
  rates: PricingRates,
): number {
  const reduction = Math.round(artistPrice * aggregatorDiscountRateOf(month, rates));
  return basePriceOf(artistPrice, rates) - reduction;
}

export interface AggregatorAdvance {
  month: number;
  rate: number;
  base: number;
  basis: "display_price" | "artist_price";
  advance: number;
  deliveryCharge: number;
  payable: number;
}

// Month 1 is charged on the display price; every later month is charged on
// the artist price. Month 2 is the only month whose rate can vary: it stays
// at the full advance rate when the previous aggregator exercised their one
// price change, and drops to 3% when they did not. Months 3 onward are
// always 3%. (The 3% figure and the "always" are intentionally left as
// literals matching the client's sheet exactly, mirroring
// frontend-web/lib/pricing.ts's own choice not to generalize this table
// beyond what was actually specified — see that file's comment above the
// equivalent function.)
export function aggregatorAdvanceForMonth({
  month,
  displayPrice,
  artistPrice,
  rates,
  previousAggregatorChangedPrice = false,
  deliveryCharge,
}: {
  month: number;
  displayPrice: number;
  artistPrice: number;
  rates: PricingRates;
  previousAggregatorChangedPrice?: boolean;
  deliveryCharge?: number;
}): AggregatorAdvance {
  const resolvedDeliveryCharge = deliveryCharge ?? rates.deliveryCharge;
  const firstMonth = month <= 1;
  const rate =
    firstMonth || (month === 2 && previousAggregatorChangedPrice)
      ? rates.aggregatorAdvanceRate
      : 0.03;
  const base = firstMonth ? displayPrice : artistPrice;
  const advance = Math.round(base * rate);

  return {
    month,
    rate,
    base,
    basis: firstMonth ? "display_price" : "artist_price",
    advance,
    deliveryCharge: resolvedDeliveryCharge,
    payable: advance + resolvedDeliveryCharge,
  };
}

// --- Delivery ---------------------------------------------------------------

function digitsOf(pincode: string): string {
  return pincode.replace(/[^0-9]/g, "");
}

export function deliveryZoneBetween(
  from: string,
  to: string,
  rates: PricingRates,
): DeliveryZone {
  const a = digitsOf(from);
  const b = digitsOf(to);
  if (a.length < 6 || b.length < 6) return "national";
  if (
    rates.remotePincodePrefixes.includes(a.slice(0, 2)) ||
    rates.remotePincodePrefixes.includes(b.slice(0, 2))
  ) {
    return "remote";
  }
  if (a.slice(0, 3) === b.slice(0, 3)) return "local";
  if (a.slice(0, 2) === b.slice(0, 2)) return "regional";
  if (a.slice(0, 1) === b.slice(0, 1)) return "metro";
  return "national";
}

export function billableWeightKg({
  actualKg,
  lengthCm,
  breadthCm,
  heightCm,
}: {
  actualKg: number;
  lengthCm?: number | null;
  breadthCm?: number | null;
  heightCm?: number | null;
}): number {
  if (!lengthCm || !breadthCm || !heightCm) return actualKg;
  const volumetric = (lengthCm * breadthCm * heightCm) / 5000;
  return Math.max(actualKg, Math.round(volumetric * 10) / 10);
}

export interface DeliveryEstimate {
  zone: DeliveryZone;
  billableKg: number;
  charge: number;
  estimated: boolean;
}

export function estimateDelivery({
  billableKg,
  fromPincode,
  toPincode,
  rates,
}: {
  billableKg?: number | null;
  fromPincode?: string | null;
  toPincode?: string | null;
  rates: PricingRates;
}): DeliveryEstimate {
  if (!billableKg || billableKg <= 0 || !fromPincode || !toPincode) {
    return { zone: "national", billableKg: billableKg ?? 0, charge: rates.deliveryCharge, estimated: false };
  }

  const zone = deliveryZoneBetween(fromPincode, toPincode, rates);
  const { base, perExtraKg } = rates.deliveryZoneRates[zone];
  const extraKg = Math.max(0, Math.ceil(billableKg - rates.deliveryBaseSlabKg));
  const charge = Math.round((base + extraKg * perExtraKg) / 10) * 10;

  return { zone, billableKg, charge, estimated: true };
}

// --- Payout timing ----------------------------------------------------------

export function payoutReleaseDate(deliveredAt: string | Date, rates: PricingRates): Date {
  const delivered = new Date(deliveredAt);
  const release = new Date(delivered);
  release.setDate(release.getDate() + rates.artistPayoutDaysAfterDelivery);
  return release;
}

export function isPayoutDue(
  deliveredAt: string | Date,
  rates: PricingRates,
  now: number = Date.now(),
): boolean {
  return payoutReleaseDate(deliveredAt, rates).getTime() <= now;
}
