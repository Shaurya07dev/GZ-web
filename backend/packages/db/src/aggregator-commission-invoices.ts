// Aggregator commission tax-invoice snapshots + sequential numbering —
// MOU Clause 9.6 (v2026.4).
//
// On a facilitated counter sale (AggregatorSaleDoc), the aggregator is
// legally the supplier for their GST-inclusive tier share of the
// markup pool: taxable share + 18% CGST+SGST (or IGST). In practice
// most aggregators can't / won't generate the invoice themselves, so
// GalleryZone produces it pre-filled and the aggregator accepts it
// in-portal via an "Agree" action. The PDF prints a clear disclaimer
// to that effect; the acceptance timestamp + IP + user-agent are
// stamped onto the snapshot.
//
// Numbering: GZ/AC/26-27/000001 — monotonic per fiscal year, allocated
// in a Firestore transaction against aggregatorCommissionInvoiceCounters.
//
// Stamp timing: on first aggregator/admin download. Lazy, same pattern
// as the customer tax invoice — a number is NOT allocated for sales
// the aggregator never opens.
//
// Markup pool is `soldPricePaise - displayPricePaise` (what the counter
// sale cleared ABOVE the price GalleryZone sent the piece out at).
// Commission rate: the slab the aggregator was on at sale time (stored
// on the sale as `commissionRate`; rates.aggregatorCommissionRate used
// as a fallback for legacy sales).

import type { Firestore } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  Collections,
  userProfileCol,
  type AggregatorCommissionInvoiceCounterDoc,
  type AggregatorCommissionInvoiceDocSnapshot,
  type AggregatorHoldingDoc,
  type AggregatorSaleDoc,
  type ArtworkDoc,
  type ProfileDoc,
  type UserDoc,
} from "./collections.ts";
import { DbError } from "./errors.ts";
import { fiscalYearOf } from "./invoices.ts";
import { findIndianState } from "./india-states.ts";
import { assertCompletePickupProfile } from "./doc-field-guards.ts";

export class AggregatorCommissionInvoiceError extends DbError {}

/** "GZ/AC/26-27/000001" — short-year form, zero-padded 6-digit sequence. */
export function formatAggregatorCommissionNumber(
  fiscalYear: string,
  seq: number,
): string {
  const short = fiscalYear.replace(/^FY\d{2}/, "");
  return `GZ/AC/${short}/${String(seq).padStart(6, "0")}`;
}

/** GalleryZone's registered identity (BILL TO party on the invoice).
 *  Passed in from the api layer which reads the INVOICE_SELLER_* env
 *  vars — the db layer does not read process.env. */
export interface GalleryZoneBillTo {
  legalName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  pan: string;
}

export interface StampAggregatorCommissionInvoiceInput {
  /** AggregatorSaleDoc id. */
  saleId: string;
  /** GalleryZone identity (same INVOICE_SELLER_* env the tax invoice
   *  reads). */
  galleryZone: GalleryZoneBillTo;
  /** Fallback commission rate when the sale was recorded before the
   *  slab feature existed (mirrors rates.aggregatorCommissionRate).
   *  Ignored if the sale itself carries a commissionRate. */
  fallbackCommissionRate: number;
  /** Service-period deadline: the billing period for the invoice.
   *  Typically the half-month the sale falls into; we take a
   *  one-week window around the sale date and let the caller pick.
   *  Kept required so the caller has to think about it. */
  servicePeriod: { from: Date; to: Date };
  /** Due date for the aggregator — typically T+15 business days from
   *  the sale. Caller computes. */
  dueDate: Date;
}

/** 20% / 35% / 50% → tier 1/2/3; anything else maps to tier 1 + the
 *  real percent. Mirrors the slab table in pricing.ts. */
function tierFromRate(rate: number): {
  tier: 1 | 2 | 3;
  tierPercent: 20 | 35 | 50;
} {
  const pct = Math.round(rate * 100);
  if (pct === 35) return { tier: 2, tierPercent: 35 };
  if (pct === 50) return { tier: 3, tierPercent: 50 };
  return { tier: 1, tierPercent: 20 };
}

/**
 * Stamps (or returns the existing) commission tax invoice for an
 * aggregator counter sale.  Idempotent — repeated downloads don't
 * allocate new numbers.
 *
 * Writes inside a transaction:
 *   - aggregatorCommissionInvoiceCounters/{fy} ← nextSeq++
 *   - aggregatorSales/{saleId}.commissionInvoice ← snapshot
 *
 * Throws AggregatorCommissionInvoiceError on missing/unfit data
 * rather than silently rendering blanks. The UI surfaces the error
 * so ops can fix the underlying profile before trying again.
 */
export async function getOrCreateAggregatorCommissionInvoice(
  db: Firestore,
  input: StampAggregatorCommissionInvoiceInput,
): Promise<AggregatorCommissionInvoiceDocSnapshot> {
  const saleRef = db.collection(Collections.aggregatorSales).doc(input.saleId);
  const saleSnap = await saleRef.get();
  if (!saleSnap.exists) {
    throw new AggregatorCommissionInvoiceError(`No sale ${input.saleId}`);
  }
  const sale = saleSnap.data() as AggregatorSaleDoc;

  // Fast path — already stamped.
  if (sale.commissionInvoice) return sale.commissionInvoice;

  // Resolve the holding so we know the aggregator and the display price.
  const holdingSnap = await db
    .collection(Collections.aggregatorHoldings)
    .doc(sale.holdingId)
    .get();
  if (!holdingSnap.exists) {
    throw new AggregatorCommissionInvoiceError(
      `No holding ${sale.holdingId} for sale ${input.saleId}`,
    );
  }
  const holding = holdingSnap.data() as AggregatorHoldingDoc;

  // Pull artwork + aggregator profile + artist name in parallel.
  const [artworkSnap, aggregatorUserSnap, aggregatorProfileSnap, artistUserSnap] =
    await Promise.all([
      db.collection(Collections.artworks).doc(sale.artworkId).get(),
      db.collection(Collections.users).doc(holding.aggregatorId).get(),
      db
        .collection(userProfileCol(holding.aggregatorId))
        .doc("data")
        .get(),
      (async () => {
        const art = await db
          .collection(Collections.artworks)
          .doc(sale.artworkId)
          .get();
        const artistId = (art.data() as ArtworkDoc | undefined)?.artistId;
        if (!artistId) return null;
        return db.collection(Collections.users).doc(artistId).get();
      })(),
    ]);
  const artwork = artworkSnap.data() as ArtworkDoc | undefined;
  const aggregatorUser = aggregatorUserSnap.data() as UserDoc | undefined;
  const aggregatorProfile = aggregatorProfileSnap.data() as
    | ProfileDoc
    | undefined;
  const artistUser = artistUserSnap?.data() as UserDoc | undefined;
  if (!artwork) {
    throw new AggregatorCommissionInvoiceError(
      `Artwork ${sale.artworkId} missing`,
    );
  }
  if (!aggregatorUser || !aggregatorProfile) {
    throw new AggregatorCommissionInvoiceError(
      `Aggregator ${holding.aggregatorId} missing or has no profile`,
    );
  }
  if (!aggregatorProfile.companyName?.trim()) {
    throw new AggregatorCommissionInvoiceError(
      `Aggregator ${holding.aggregatorId} has no companyName — complete the profile before downloading`,
    );
  }
  // Pickup address is the aggregator's FROM party on the commission
  // invoice — all four fields must be present or the Rule 46 doc is
  // legally defective. Message surfaces the specific missing field so
  // ops can point the aggregator to it.
  assertCompletePickupProfile(
    "Aggregator",
    aggregatorProfile,
    AggregatorCommissionInvoiceError,
  );

  // Markup pool = sold price ABOVE the displayPrice (what GalleryZone
  // sent the piece out at). Can't be negative — the floor matches
  // aggregatorCommissionOf() in domain/pricing.ts.
  const markupPoolPaise = Math.max(
    0,
    sale.soldPricePaise - holding.displayPricePaise,
  );
  const rate = sale.commissionRate ?? input.fallbackCommissionRate;
  const { tier, tierPercent } = tierFromRate(rate);
  const grossInclusivePaise = Math.round(markupPoolPaise * rate);
  if (grossInclusivePaise <= 0) {
    throw new AggregatorCommissionInvoiceError(
      `Sale ${input.saleId} has no commission (markup pool ₹${markupPoolPaise / 100}); invoice does not apply`,
    );
  }

  // Legacy "artistPricePaise" on the holding — where the display price
  // came from. Not every holding stores it as a separate field; fall
  // back to re-deriving from displayPricePaise less GST when absent.
  // GST on art = 12% (HSN 9701); mirrors displayPriceOf() math.
  const artistPricePaise =
    holding.sellingPricePaise ??
    Math.round(holding.displayPricePaise / 1.12);

  const aggregatorState = findIndianState(aggregatorProfile.pickupState ?? null);
  const gzState = findIndianState(input.galleryZone.state);
  if (!aggregatorState) {
    throw new AggregatorCommissionInvoiceError(
      `Aggregator state "${aggregatorProfile.pickupState}" is not an Indian state/UT`,
    );
  }
  if (!gzState) {
    throw new AggregatorCommissionInvoiceError(
      `GalleryZone state "${input.galleryZone.state}" is not an Indian state/UT — check INVOICE_SELLER_STATE`,
    );
  }

  // Tax breakdown — GST-INCLUSIVE share, 18% rate.
  // If the aggregator has no GSTIN they can't legally charge GST, so
  // the whole share is "taxable" and GST is zero. (The user's aggregator
  // onboarding gate makes this edge case rare in practice.)
  const gstinTrim = aggregatorProfile.gstin?.trim() || null;
  let taxBreakdown: AggregatorCommissionInvoiceDocSnapshot["taxBreakdown"];
  if (!gstinTrim) {
    taxBreakdown = {
      kind: "unregistered",
      taxablePaise: grossInclusivePaise,
      ratePercent: 0,
    };
  } else {
    const taxable = Math.round((grossInclusivePaise * 100) / 118);
    const gst = grossInclusivePaise - taxable;
    if (aggregatorState.numericCode === gzState.numericCode) {
      // Intra-state. Half-split with the +1 paise remainder landing on
      // SGST (matches the sample).
      const cgst = Math.floor(gst / 2);
      const sgst = gst - cgst;
      taxBreakdown = {
        kind: "intra_state",
        taxablePaise: taxable,
        cgstPaise: cgst,
        sgstPaise: sgst,
        ratePercent: 18,
      };
    } else {
      taxBreakdown = {
        kind: "inter_state",
        taxablePaise: taxable,
        igstPaise: gst,
        ratePercent: 18,
      };
    }
  }

  const now = new Date();
  const fiscalYear = fiscalYearOf(now);
  const counterRef = db
    .collection(Collections.aggregatorCommissionInvoiceCounters)
    .doc(fiscalYear);

  const stamped = await db.runTransaction(async (tx) => {
    // Re-check inside the tx — a parallel click may have stamped.
    const saleInTx = (await tx.get(saleRef)).data() as
      | AggregatorSaleDoc
      | undefined;
    if (saleInTx?.commissionInvoice) return saleInTx.commissionInvoice;

    const counterSnap = await tx.get(counterRef);
    const seq =
      (counterSnap.data() as
        | AggregatorCommissionInvoiceCounterDoc
        | undefined)?.nextSeq ?? 1;
    const nextSeq = seq + 1;
    const invoiceNumber = formatAggregatorCommissionNumber(fiscalYear, seq);

    const saleDate = sale.soldAt instanceof Timestamp ? sale.soldAt : Timestamp.fromDate(now);

    const snapshot: AggregatorCommissionInvoiceDocSnapshot = {
      number: invoiceNumber,
      fiscalYear,
      issuedAt: Timestamp.fromDate(now),
      dueDate: Timestamp.fromDate(input.dueDate),
      servicePeriod: {
        from: Timestamp.fromDate(input.servicePeriod.from),
        to: Timestamp.fromDate(input.servicePeriod.to),
      },
      aggregator: {
        legalName: aggregatorProfile.companyName!.trim(),
        addressLine1: aggregatorProfile.pickupLine1!,
        addressLine2: aggregatorProfile.pickupLine2?.trim() || null,
        city: aggregatorProfile.pickupCity!,
        state: aggregatorState.name,
        pincode: aggregatorProfile.pickupPincode!,
        stateCode: aggregatorState.code,
        numericCode: aggregatorState.numericCode,
        phone: aggregatorUser.phone ?? null,
        email: aggregatorUser.email ?? null,
        pan: aggregatorProfile.pan?.trim() || null,
        gstin: gstinTrim,
      },
      billedTo: {
        legalName: input.galleryZone.legalName,
        addressLine1: input.galleryZone.addressLine1,
        addressLine2: input.galleryZone.addressLine2,
        city: input.galleryZone.city,
        state: gzState.name,
        pincode: input.galleryZone.pincode,
        gstin: input.galleryZone.gstin,
        stateCode: gzState.code,
        pan: input.galleryZone.pan,
      },
      sale: {
        artworkId: sale.artworkId,
        artworkTitle: artwork.title,
        artistName: artistUser?.name ?? "Artist",
        medium: artwork.medium ?? null,
        // Counter sales have no customer tax invoice from us; the
        // aggregator issues their own buyer bill at the counter. We
        // print a cross-reference to our internal sale id so the
        // invoice can be reconciled back to the sale record.
        customerInvoiceNumber: `GZ-SALE/${input.saleId}`,
        saleDate,
        listedSellingPaise: sale.soldPricePaise,
        artistPaise: artistPricePaise,
      },
      commercialShare: {
        tier,
        tierPercent,
        markupPoolPaise,
        grossInclusivePaise,
      },
      taxBreakdown,
      acceptance: null,
    };

    tx.set(counterRef, { fiscalYear, nextSeq });
    tx.update(saleRef, { commissionInvoice: snapshot });
    return snapshot;
  });

  return stamped;
}

/**
 * Stamp the aggregator's acceptance onto a stamped commission invoice.
 * Idempotent — the first acceptance wins and later calls return the
 * existing block. Throws if the invoice hasn't been stamped yet (the
 * aggregator must view it first; the download allocates the number).
 */
export async function acceptAggregatorCommissionInvoice(
  db: Firestore,
  input: {
    saleId: string;
    aggregatorId: string;
    acceptedByIp: string;
    acceptedByUserAgent: string;
  },
): Promise<AggregatorCommissionInvoiceDocSnapshot> {
  const saleRef = db.collection(Collections.aggregatorSales).doc(input.saleId);
  return db.runTransaction(async (tx) => {
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists) {
      throw new AggregatorCommissionInvoiceError(`No sale ${input.saleId}`);
    }
    const sale = saleSnap.data() as AggregatorSaleDoc;
    const holdingSnap = await tx.get(
      db.collection(Collections.aggregatorHoldings).doc(sale.holdingId),
    );
    const holding = holdingSnap.data() as AggregatorHoldingDoc | undefined;
    if (!holding || holding.aggregatorId !== input.aggregatorId) {
      // 404-like — don't confirm the id belongs to someone else.
      throw new AggregatorCommissionInvoiceError(`No sale ${input.saleId}`);
    }
    if (!sale.commissionInvoice) {
      throw new AggregatorCommissionInvoiceError(
        `Commission invoice not stamped yet for sale ${input.saleId} — download it first`,
      );
    }
    if (sale.commissionInvoice.acceptance) return sale.commissionInvoice;

    const updated: AggregatorCommissionInvoiceDocSnapshot = {
      ...sale.commissionInvoice,
      acceptance: {
        acceptedAt: Timestamp.now(),
        acceptedByIp: input.acceptedByIp.slice(0, 64),
        acceptedByUserAgent: input.acceptedByUserAgent.slice(0, 256),
      },
    };
    tx.update(saleRef, {
      commissionInvoice: updated,
      commissionInvoiceAcceptedAt: FieldValue.serverTimestamp(),
    });
    return updated;
  });
}
