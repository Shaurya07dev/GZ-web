// Every rupee figure in GalleryZone comes from here.
//
// Source: the client's handwritten "How the money flows" sheets (21 Aug 2026),
// which supersede both the August meeting notes and the signed MOUs wherever
// the three disagree. The worked example on those sheets, which every function
// below reproduces exactly:
//
//   MARKETPLACE                          AGGREGATOR
//   Artist price      1,00,000           Artist price        1,00,000
//   + 30% markup      1,30,000           + 30% markup        1,30,000
//   + 5% GST (inside) 1,36,500  DISPLAY  aggregator uplift   1,50,000
//   + delivery            2,500          + 5% GST (inside)   1,57,500  DISPLAY
//   ----------------------------         + delivery              2,500
//   Customer pays     1,39,000           ----------------------------
//   Artist gets       1,00,000           Customer pays       1,60,000
//   GalleryZone keeps    30,000          Artist gets            95,500
//                                        Aggregator gets        20,000
//                                        GalleryZone keeps      42,000
//
// GST sits INSIDE the displayed price — it is not added at checkout. That is
// the single biggest departure from how this code used to work.
//
// The client answered the seven outstanding questions on 25 Aug 2026, so every
// rule below is settled. lib/pricing.check.ts replays their worked example and
// fails loudly if any of it drifts.

// --- Rates ------------------------------------------------------------------

// Confirmed by the client (25 Aug): 5% is the current HSN 9701 rate. The 12%
// figure is the 2025 one and no longer applies. Changing this number re-prices
// every listing on the site.
//
// GST is charged on the price of the GOODS and on nothing else — the customer's
// price for the artwork, which on the client's example is the aggregator's
// 1,50,000. Delivery is not taxed, commission is not taxed, and no party
// invoices another for GST. Every "and GST on top of that too" question has the
// same answer: no. checkoutTotal() and aggregatorCommissionOf() are where this
// is enforced, and lib/pricing.check.ts asserts it in both directions.
export const GST_RATE = 0.05;

/** GalleryZone's margin over the artist's price, before GST. */
export const PLATFORM_MARKUP = 0.3;

// Confirmed: free to list today, 1% of listing value (or a subscription)
// later. Kept as a rate rather than a boolean so switching it on is a value
// change, not a code change.
export const ARTIST_LISTING_FEE_RATE = 0;

/** Aggregator MOU §7 — security deposit paid before taking possession. */
export const AGGREGATOR_ADVANCE_RATE = 0.05;

/** Aggregator MOU §8 — 20% of (selling price − artist price). */
export const AGGREGATOR_COMMISSION_RATE = 0.2;

// Deducted from the artist's settlement on aggregator sales only. Confirmed by
// the client (25 Aug): "in the marketplace we pay 100% of the artist quoted
// price" — marketplace sales take nothing off.
export const ARTIST_CONVENIENCE_RATE = 0.02;

/** Charged to the customer at checkout. Zero during the launch period. */
export const CUSTOMER_CONVENIENCE_FEE = 0;

// The client wants delivery quoted LIVE by Shiprocket, using the weight and
// both parties' addresses, and only falling back to bands if that cannot be
// made to work. Live rates need a server (see NEXT_SESSION_PROMPT.md), so
// estimateDelivery() below reproduces Shiprocket's own model — billable weight
// x distance zone — as the seam their rate API drops into.
//
// This flat figure is only the last-resort fallback, used when an artwork has
// no weight recorded or no destination is known yet.
export const DELIVERY_CHARGE = 2500;

/** Confirmed by Yash: the artist is paid within 7 days of delivery. */
export const ARTIST_PAYOUT_DAYS_AFTER_DELIVERY = 7;

// --- Price ladder -----------------------------------------------------------

/** Artist's price → GalleryZone's price before GST. 1,00,000 → 1,30,000. */
export function basePriceOf(artistPrice: number): number {
  return Math.round(artistPrice * (1 + PLATFORM_MARKUP));
}

/**
 * Artist's price → the number shown on the website, GST included.
 * 1,00,000 → 1,36,500. This is what `Artwork.customerPrice` holds.
 */
export function displayPriceOf(artistPrice: number): number {
  return withGst(basePriceOf(artistPrice));
}

/** Adds GST to a pre-tax figure. 1,30,000 → 1,36,500. */
export function withGst(preTax: number): number {
  return Math.round(preTax * (1 + GST_RATE));
}

/** Strips GST back out of a displayed price. 1,36,500 → 1,30,000. */
export function exGst(displayPrice: number): number {
  return Math.round(displayPrice / (1 + GST_RATE));
}

/** The GST already contained in a displayed price. 1,36,500 → 6,500. */
export function gstIncludedIn(displayPrice: number): number {
  return displayPrice - exGst(displayPrice);
}

/**
 * Works the ladder backwards. Needed because most fixture artworks carry a
 * `customerPrice` with no stored artist price behind it, and the aggregator's
 * commission is defined against the artist's price.
 */
export function artistPriceFrom(displayPrice: number): number {
  return Math.round(exGst(displayPrice) / (1 + PLATFORM_MARKUP));
}

/** The listing fee an artist owes for putting a piece up. ₹0 today. */
export function listingFeeOf(artistPrice: number): number {
  return Math.round(artistPrice * ARTIST_LISTING_FEE_RATE);
}

// --- Checkout ---------------------------------------------------------------

export interface CheckoutTotal {
  /** The artwork's displayed price, GST already inside it. */
  displayPrice: number;
  /** The GST portion of `displayPrice`, shown for information only. */
  gstIncluded: number;
  deliveryCharge: number;
  convenienceFee: number;
  /** What the customer actually pays. */
  total: number;
}

// Never add gstIncluded to the total — it is already part of displayPrice.
// Splitting it out here (rather than at each call site) is what stops it being
// double-counted, which is exactly what the old add-on-top code did.
export function checkoutTotal(displayPrice: number): CheckoutTotal {
  return {
    displayPrice,
    gstIncluded: gstIncludedIn(displayPrice),
    deliveryCharge: DELIVERY_CHARGE,
    convenienceFee: CUSTOMER_CONVENIENCE_FEE,
    total: displayPrice + DELIVERY_CHARGE + CUSTOMER_CONVENIENCE_FEE,
  };
}

// --- Settlements ------------------------------------------------------------

/** Which side of the business a sale came through. */
export type SaleChannel = "marketplace" | "aggregator";

export interface ArtistSettlement {
  gross: number;
  deliveryDeduction: number;
  convenienceDeduction: number;
  net: number;
}

// Marketplace: the artist is paid their asking price in full — GalleryZone's
// entire take is the markup the customer paid on top. Aggregator: the sheet
// deducts the artist-to-aggregator delivery leg and 2% convenience, which is
// also what settles the contradiction between artist MOU §10 (artist pays the
// placement leg) and aggregator MOU §7 (aggregator pays it) — the artist does.
export function artistSettlementOf(
  artistPrice: number,
  channel: SaleChannel,
): ArtistSettlement {
  if (channel === "marketplace") {
    return {
      gross: artistPrice,
      deliveryDeduction: 0,
      convenienceDeduction: 0,
      net: artistPrice,
    };
  }
  const convenienceDeduction = Math.round(
    artistPrice * ARTIST_CONVENIENCE_RATE,
  );
  return {
    gross: artistPrice,
    deliveryDeduction: DELIVERY_CHARGE,
    convenienceDeduction,
    net: artistPrice - DELIVERY_CHARGE - convenienceDeduction,
  };
}

/**
 * Aggregator MOU §8. Both prices are compared before GST, because the
 * aggregator sets a pre-tax price and GST is applied to it afterwards.
 */
export function aggregatorCommissionOf(
  displayPrice: number,
  artistPrice: number,
): number {
  const markup = Math.max(0, exGst(displayPrice) - artistPrice);
  return Math.round(markup * AGGREGATOR_COMMISSION_RATE);
}

/** Aggregator MOU §7 — 5% of the price the piece is being displayed at. */
export function aggregatorAdvanceOf(displayPrice: number): number {
  return Math.round(displayPrice * AGGREGATOR_ADVANCE_RATE);
}

// --- The aggregator cycle ---------------------------------------------------
//
// A piece that does not sell moves on rather than sitting still: it is offered
// to a DIFFERENT aggregator each month, up to five of them. The sixth month is
// not a placement — it is deliberately left free for transit and for anything
// that goes wrong along the way, which is why both tables below stop at five.
//
// Two things change from month to month, and they change independently:
//
//   Month  Offered to the aggregator at   Advance
//   1      1,30,000                       5% of the DISPLAY price
//   2      1,28,000                       5% or 3% of the ARTIST price
//   3      1,26,000                       3% of the artist price
//   4      1,24,000                       3% of the artist price
//   5      1,22,000                       3% of the artist price
//
// Every month also carries the delivery charge alongside the advance.

export const AGGREGATOR_CYCLE_MONTHS = 5;

/** Artist MOU §18 — the whole listing runs 180 days and then the piece goes home. */
export const AGGREGATOR_LISTING_DAYS = 180;

/** One aggregator's display window. */
export const AGGREGATOR_PLACEMENT_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(from: string | Date, days: number): Date {
  return new Date(new Date(from).getTime() + days * DAY_MS);
}

/** When the artwork must be back with the artist, whatever has happened since. */
export function listingEndsAt(cycleStartedAt: string | Date): Date {
  return addDays(cycleStartedAt, AGGREGATOR_LISTING_DAYS);
}

export function daysLeftInListing(
  cycleStartedAt: string | Date,
  now: number = Date.now(),
): number {
  return Math.max(
    0,
    Math.ceil((listingEndsAt(cycleStartedAt).getTime() - now) / DAY_MS),
  );
}

/**
 * Whether there is room to hand the piece to ANOTHER aggregator. A stub of
 * fewer than thirty days is not a placement — nobody is shipped a painting for
 * a fortnight — so the remainder goes to whoever already has it.
 */
export function canPlaceWithAnotherAggregator({
  cycleStartedAt,
  placementsSoFar,
  now = Date.now(),
}: {
  cycleStartedAt: string | Date | null;
  placementsSoFar: number;
  now?: number;
}): boolean {
  if (cycleStartedAt === null) return true; // nothing placed yet — the clock hasn't started
  if (placementsSoFar >= AGGREGATOR_CYCLE_MONTHS) return false;
  return daysLeftInListing(cycleStartedAt, now) >= AGGREGATOR_PLACEMENT_DAYS;
}

export interface PlacementWindow {
  expiresAt: Date;
  /**
   * True when this aggregator keeps the piece past the usual thirty days
   * because the leftover was too short to place with anyone else.
   */
  extended: boolean;
}

/**
 * A placement runs thirty days — unless doing so would leave a stub shorter
 * than another placement, in which case this aggregator holds it through to the
 * end of the 180 days rather than the piece making a pointless extra journey.
 */
export function placementWindow({
  cycleStartedAt,
  assignedAt,
}: {
  cycleStartedAt: string | Date;
  assignedAt: string | Date;
}): PlacementWindow {
  const listingEnd = listingEndsAt(cycleStartedAt);
  const naturalEnd = addDays(assignedAt, AGGREGATOR_PLACEMENT_DAYS);
  const leftover = listingEnd.getTime() - naturalEnd.getTime();

  if (leftover < AGGREGATOR_PLACEMENT_DAYS * DAY_MS) {
    return { expiresAt: listingEnd, extended: leftover > 0 };
  }
  return { expiresAt: naturalEnd, extended: false };
}

// The reduction is a percentage of the ARTIST's price, taken off the price
// GalleryZone offers the next aggregator. It comes out of GalleryZone's own
// margin: the artist is still paid their full price, and the marketplace
// listing never moves. Confirmed by the client (25 Aug): "the effect is only on
// aggregator price only, no implications on market prices".
export const AGGREGATOR_MONTHLY_DISCOUNT_RATES = [0, 0.02, 0.04, 0.06, 0.08];

/** Clamps a cycle month into the 1..5 table. Month 6+ holds at month 5. */
function cycleIndex(month: number): number {
  if (month < 1) return 0;
  return Math.min(month, AGGREGATOR_CYCLE_MONTHS) - 1;
}

export function aggregatorDiscountRateOf(month: number): number {
  return AGGREGATOR_MONTHLY_DISCOUNT_RATES[cycleIndex(month)]!;
}

/**
 * What GalleryZone offers the aggregator in a given month of the cycle, before
 * that aggregator adds their own uplift. A 1,00,000 artist price gives
 * 1,30,000 in month 1 and 1,22,000 in month 5.
 */
export function aggregatorOfferPriceOf(
  artistPrice: number,
  month: number,
): number {
  const reduction = Math.round(artistPrice * aggregatorDiscountRateOf(month));
  return basePriceOf(artistPrice) - reduction;
}

export interface AggregatorAdvance {
  month: number;
  rate: number;
  /** What the rate is applied to — display price in month 1, artist price after. */
  base: number;
  basis: "display_price" | "artist_price";
  advance: number;
  deliveryCharge: number;
  /** Advance plus delivery — what is actually locked from the wallet. */
  payable: number;
}

// Month 1 is charged on the display price; every later month is charged on the
// artist price. Month 2 is the only month whose RATE can vary: it stays at 5%
// when the previous aggregator exercised their one price change, and drops to
// 3% when they did not. Months 3 onward are always 3%.
export function aggregatorAdvanceForMonth({
  month,
  displayPrice,
  artistPrice,
  previousAggregatorChangedPrice = false,
  deliveryCharge = DELIVERY_CHARGE,
}: {
  month: number;
  displayPrice: number;
  artistPrice: number;
  previousAggregatorChangedPrice?: boolean;
  deliveryCharge?: number;
}): AggregatorAdvance {
  const firstMonth = month <= 1;
  const rate =
    firstMonth || (month === 2 && previousAggregatorChangedPrice)
      ? AGGREGATOR_ADVANCE_RATE
      : 0.03;
  const base = firstMonth ? displayPrice : artistPrice;
  const advance = Math.round(base * rate);

  return {
    month,
    rate,
    base,
    basis: firstMonth ? "display_price" : "artist_price",
    advance,
    deliveryCharge,
    payable: advance + deliveryCharge,
  };
}

// --- Delivery ---------------------------------------------------------------
//
// The client's preference is a live Shiprocket quote, off the weight and both
// parties' addresses. That needs a server, so this reproduces Shiprocket's own
// pricing shape and is the single function their rate API replaces.
//
// TWO things drive a courier's price, and the second is the one that is easily
// forgotten: WEIGHT, where the greater of actual and volumetric weight is
// billed, and DISTANCE, as a zone between the two pincodes. Quoting on size
// alone is wrong by a wide margin on a long haul.

export type DeliveryZone =
  | "local"
  | "regional"
  | "metro"
  | "national"
  | "remote";

export const DELIVERY_ZONE_LABEL: Record<DeliveryZone, string> = {
  local: "Same city",
  regional: "Nearby",
  metro: "Same region",
  national: "Rest of India",
  remote: "Remote area",
};

// The first slab covers 5kg, because boxed artwork is never lighter than that
// once volumetric weight is applied; every additional kilo is charged on top.
// Shaped after Shiprocket's surface rate card.
const ZONE_RATES: Record<DeliveryZone, { base: number; perExtraKg: number }> = {
  local: { base: 400, perExtraKg: 55 },
  regional: { base: 620, perExtraKg: 80 },
  metro: { base: 780, perExtraKg: 95 },
  national: { base: 950, perExtraKg: 120 },
  remote: { base: 1400, perExtraKg: 175 },
};

const BASE_SLAB_KG = 5;

// Jammu & Kashmir, Himachal and the North East cost materially more to reach
// and every courier treats them as a surcharge zone.
const REMOTE_PREFIXES = ["18", "19", "78", "79"];

function digitsOf(pincode: string): string {
  return pincode.replace(/[^0-9]/g, "");
}

// Indian pincodes are geographic: the first digit is a postal region, the
// first two a circle, the first three a sorting district. Sharing more leading
// digits means being closer, which is all a zone needs to approximate. A real
// Shiprocket quote replaces this with their own zone matrix.
/** Zone between two Indian pincodes, read off the postal numbering geography. */
export function deliveryZoneBetween(from: string, to: string): DeliveryZone {
  const a = digitsOf(from);
  const b = digitsOf(to);
  if (a.length < 6 || b.length < 6) return "national";
  if (
    REMOTE_PREFIXES.includes(a.slice(0, 2)) ||
    REMOTE_PREFIXES.includes(b.slice(0, 2))
  ) {
    return "remote";
  }
  if (a.slice(0, 3) === b.slice(0, 3)) return "local";
  if (a.slice(0, 2) === b.slice(0, 2)) return "regional";
  if (a.slice(0, 1) === b.slice(0, 1)) return "metro";
  return "national";
}

/**
 * Billable weight: couriers charge the greater of what a parcel weighs and what
 * it occupies. For artwork the volumetric figure almost always wins — a 4kg
 * framed canvas in a 100x70x12cm box bills as 16.8kg.
 */
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
  /** False when there wasn't enough to go on and the flat fallback was used. */
  estimated: boolean;
}

export function estimateDelivery({
  billableKg,
  fromPincode,
  toPincode,
}: {
  billableKg?: number | null;
  fromPincode?: string | null;
  toPincode?: string | null;
}): DeliveryEstimate {
  if (!billableKg || billableKg <= 0 || !fromPincode || !toPincode) {
    return {
      zone: "national",
      billableKg: billableKg ?? 0,
      charge: DELIVERY_CHARGE,
      estimated: false,
    };
  }

  const zone = deliveryZoneBetween(fromPincode, toPincode);
  const { base, perExtraKg } = ZONE_RATES[zone];
  const extraKg = Math.max(0, Math.ceil(billableKg - BASE_SLAB_KG));
  // Rounded to the nearest ten rupees — a courier quote to the paisa reads as
  // false precision on a figure that is an estimate either way.
  const charge = Math.round((base + extraKg * perExtraKg) / 10) * 10;

  return { zone, billableKg, charge, estimated: true };
}

// --- Payout timing ----------------------------------------------------------

/** The artist's money is released 7 days after the piece is delivered. */
export function payoutReleaseDate(deliveredAt: string | Date): Date {
  const delivered = new Date(deliveredAt);
  const release = new Date(delivered);
  release.setDate(
    release.getDate() + ARTIST_PAYOUT_DAYS_AFTER_DELIVERY,
  );
  return release;
}

export function isPayoutDue(
  deliveredAt: string | Date,
  now: number = Date.now(),
): boolean {
  return payoutReleaseDate(deliveredAt).getTime() <= now;
}
