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
// Anything still awaiting the client's answer is marked OPEN and given the
// value the sheet literally shows, so switching it later is a one-line edit
// here and nowhere else.

// --- Rates ------------------------------------------------------------------

// OPEN (client question 6): the sheet says 5%. Original art is normally 12%
// under HSN 9701. Changing this number re-prices every listing on the site.
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

// Deducted from the artist's settlement on aggregator sales only. Marketplace
// sales pay the artist their full price with nothing taken off.
// OPEN (client question 7): confirm this really is aggregator-only.
export const ARTIST_CONVENIENCE_RATE = 0.02;

/** Charged to the customer at checkout. Zero during the launch period. */
export const CUSTOMER_CONVENIENCE_FEE = 0;

// OPEN (client question 5): one flat rate for every piece, or bands by packed
// size. Flat, at the sheet's own figure, until that is settled — Shiprocket
// bills on volumetric weight, so a large canvas really does cost several times
// what a small print does (see NEXT_SESSION_PROMPT.md).
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
