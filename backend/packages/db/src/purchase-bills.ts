// Purchase-cum-Payment Bill snapshots + sequential voucher numbering —
// CGST Rule 52.
//
// When GalleryZone (a registered recipient) pays an UNREGISTERED supplier
// (the artist) for a sold piece, Rule 52 says we must issue a payment
// voucher summarising the deductions and acknowledging the payout. The
// voucher's a GST document we KEEP, not an invoice the artist issues —
// but the artist gets a copy for their own books.
//
// Numbering: GZ/PV/26-27/000001 — monotonic per fiscal year, allocated in
// a Firestore transaction against paymentVoucherCounters/{fy}.
//
// Stamp timing: when admin marks a settlement "processed" (i.e. the money
// has moved to the artist's bank). Idempotent — re-marking a processed
// settlement returns the already-stamped voucher without re-allocating a
// number.

import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import {
  Collections,
  artworkPricingCol,
  userProfileCol,
  type ArtworkDoc,
  type ArtworkPricingDoc,
  type OrderDoc,
  type PaymentVoucherCounterDoc,
  type ProfileDoc,
  type PurchaseBillPayer,
  type PurchaseBillSnapshot,
  type SettlementDoc,
  type UserDoc,
} from "./collections.ts";
import { DbError } from "./errors.ts";
import { fiscalYearOf } from "./invoices.ts";
import { findIndianState } from "./india-states.ts";
import { assertCompletePickupProfile } from "./doc-field-guards.ts";
import {
  artistSettlementOf,
  type PricingRates,
  type SaleChannel,
} from "@galleryzone/domain";

export class PurchaseBillError extends DbError {}

/** "GZ/PV/26-27/000001" — short-year form, zero-padded 6-digit sequence. */
export function formatVoucherNumber(fiscalYear: string, seq: number): string {
  const short = fiscalYear.replace(/^FY\d{2}/, "");
  return `GZ/PV/${short}/${String(seq).padStart(6, "0")}`;
}

export interface StampPurchaseBillInput {
  /** The settlement being marked processed. We derive channel +
   *  order id from this doc. */
  settlementId: string;
  /** GalleryZone's registered identity (same INVOICE_SELLER_* env the
   *  tax invoice reads). Separate type from `PurchaseBillPayer` is
   *  intentional — this type lives in the apps/api layer; the DB
   *  layer doesn't import from apps/. The caller translates. */
  payer: PurchaseBillPayer;
  /** How the money moved to the artist. */
  paymentMode: PurchaseBillSnapshot["paymentMode"];
  /** Bank UTR / RazorpayX payout id / cheque number — whatever the
   *  reference on the actual payout rail is. */
  paymentRef: string;
  /** Pricing config version active at sale time, so the voucher's
   *  math exactly matches what was credited to the artist's payable
   *  (packages/domain/src/settlement.ts uses the same rates). */
  rates: PricingRates;
  /** Was the artist above the ₹5 lakh FY threshold at sale time?
   *  Mirrors the flag used when the sale was first posted — the
   *  voucher must line up with the ledger. */
  tdsApplies: boolean;
  /** Aggregator-only. Real "other charges" billed on this sale.
   *  Defaults to the config rate when absent. Not inferred on
   *  marketplace-channel. */
  otherChargesPaise?: number;
  /** Aggregator-only. Real delivery leg. Omit on marketplace. */
  deliveryChargePaise?: number;
  /** Aggregator-only. Readable name of the aggregator venue
   *  ("Art Fair Hyderabad — Jubilee Hills"). Printed under the artwork
   *  line for context. */
  soldViaAggregator?: string | null;
  /** Platform/gallery facilitation fee charged on marketplace channel
   *  (if any). Null → 0. Ignored on aggregator channel. */
  platformFacilitationPaise?: number | null;
}

/**
 * Stamps (or returns the existing) purchase-cum-payment bill for an
 * order's artist settlement.  Idempotent — repeated admin "mark paid"
 * clicks don't allocate new voucher numbers.
 *
 * Writes inside a transaction:
 *   - paymentVoucherCounters/{fy} ← nextSeq++
 *   - orders/{orderId}.purchaseBill ← snapshot
 *
 * Throws PurchaseBillError on bad input (missing order, holding or
 * profile) rather than silently writing blanks. The admin UI surfaces
 * the error so ops fix the underlying data (an artist without a
 * pickup address, say) before trying again.
 */
export async function getOrCreatePurchaseBill(
  db: Firestore,
  input: StampPurchaseBillInput,
): Promise<PurchaseBillSnapshot> {
  // Resolve the settlement first — it tells us which order + channel.
  const settlementRef = db
    .collection(Collections.settlements)
    .doc(input.settlementId);
  const settlementSnap = await settlementRef.get();
  if (!settlementSnap.exists) {
    throw new PurchaseBillError(`No settlement ${input.settlementId}`);
  }
  const settlement = settlementSnap.data() as SettlementDoc;
  if (!settlement.orderId) {
    // Royalty rows (artist_royalty kind) don't have an order and don't
    // get a purchase bill — they're a separate 2% transfer fee, not a
    // payout against a sale. Skip silently; caller can ignore.
    throw new PurchaseBillError(
      `Settlement ${input.settlementId} has no orderId (kind=${settlement.kind ?? "sale"}); purchase bill does not apply`,
    );
  }
  const orderRef = db.collection(Collections.orders).doc(settlement.orderId);

  // Fast path — already stamped. Keeps the counter out of the common
  // case (admin marks paid, bill downloads).
  const existingOrderSnap = await orderRef.get();
  if (!existingOrderSnap.exists) {
    throw new PurchaseBillError(`No order ${settlement.orderId}`);
  }
  const order = existingOrderSnap.data() as OrderDoc;
  if (order.purchaseBill) return order.purchaseBill;

  // Channel derivation: settlement.holdingId populated ⇒ aggregator.
  const channel: SaleChannel = settlement.holdingId ? "aggregator" : "marketplace";

  // Pull artist, artwork + pricing in parallel.
  const [artworkSnap, pricingSnap, artistUserSnap, artistProfileSnap] =
    await Promise.all([
      db.collection(Collections.artworks).doc(order.artworkId).get(),
      db.collection(artworkPricingCol(order.artworkId)).doc("data").get(),
      db.collection(Collections.users).doc(settlement.artistId).get(),
      db
        .collection(userProfileCol(settlement.artistId))
        .doc("data")
        .get(),
    ]);
  const artwork = artworkSnap.data() as ArtworkDoc | undefined;
  const pricing = pricingSnap.data() as ArtworkPricingDoc | undefined;
  const artistUser = artistUserSnap.data() as UserDoc | undefined;
  const artistProfile = artistProfileSnap.data() as ProfileDoc | undefined;
  if (!artwork) {
    throw new PurchaseBillError(`Artwork ${order.artworkId} missing`);
  }
  if (!artistUser || !artistProfile) {
    throw new PurchaseBillError(
      `Artist ${settlement.artistId} missing or has no profile`,
    );
  }
  // The voucher is a Rule 52 payment document — the payee's address
  // has to print on it. Refuse to stamp rather than freeze blanks that
  // can't be edited after release.
  assertCompletePickupProfile("Artist", artistProfile, PurchaseBillError);

  // Artist price — prefer the frozen value on the order (stored at
  // checkout), fall back to the pricing subcollection for legacy rows.
  const artistPricePaise =
    order.artistPricePaise ??
    (pricing?.artistPricePaise ?? settlement.artistAmountPaise);

  // Compute the deductions the same way the ledger did at posting
  // time — this guarantees the printed bill lines up exactly with
  // the artist_payable amount on the settlement row.
  const settlementMath = artistSettlementOf(artistPricePaise, channel, input.rates, {
    tdsApplies: input.tdsApplies,
    ...(input.otherChargesPaise === undefined
      ? {}
      : { otherChargesPaise: input.otherChargesPaise }),
    ...(input.deliveryChargePaise === undefined
      ? {}
      : { deliveryChargePaise: input.deliveryChargePaise }),
  });

  // 18% service GST is accumulated on (convenience + technology +
  // other) in settlementMath.serviceGstDeduction. For the printed
  // bill we want to split it per-row so the user can see which row
  // contributed which chunk. 18% applied per-row is the same total
  // because the GST rate is uniform on all three.
  const convGst = Math.round(settlementMath.convenienceDeduction * input.rates.serviceGstRate);
  const techGst = Math.round(settlementMath.technologyDeduction * input.rates.serviceGstRate);
  const otherGst = Math.round(settlementMath.otherChargesDeduction * input.rates.serviceGstRate);

  const payer = input.payer;
  const payee = {
    fullName: artistUser.name ?? "Artist",
    addressLine1: artistProfile.pickupLine1!,
    addressLine2: artistProfile.pickupLine2 ?? null,
    city: artistProfile.pickupCity!,
    state: artistProfile.pickupState!,
    pincode: artistProfile.pickupPincode!,
    pan: artistProfile.pan?.trim() || null,
    phone: artistUser.phone ?? null,
    gstStatus: artistProfile.gstin?.trim() || "Unregistered (Below Threshold)",
  };

  // Intra-state service classification (payer vs payee state). Decides
  // CGST+SGST vs IGST on the convenience/technology rows.
  const normalizeState = (s: string | null | undefined) =>
    (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const intraState = normalizeState(payer.state) === normalizeState(payee.state);

  // Customer tax invoice reference — the order may or may not have its
  // tax invoice stamped yet (depends on whether the buyer has
  // downloaded it). Null is acceptable per Rule 52.
  const customerInvoiceNumber = order.invoice?.number ?? null;

  const now = new Date();
  const fiscalYear = fiscalYearOf(now);
  const counterRef = db
    .collection(Collections.paymentVoucherCounters)
    .doc(fiscalYear);

  const number = await db.runTransaction(async (tx) => {
    // Re-check inside the tx — a parallel admin click may have stamped.
    const orderInTx = (await tx.get(orderRef)).data() as OrderDoc | undefined;
    if (orderInTx?.purchaseBill) return orderInTx.purchaseBill.number;

    const counterSnap = await tx.get(counterRef);
    const seq =
      ((counterSnap.data() as PaymentVoucherCounterDoc | undefined)?.nextSeq ?? 1);
    const nextSeq = seq + 1;
    const voucherNumber = formatVoucherNumber(fiscalYear, seq);

    const snapshot: PurchaseBillSnapshot = {
      number: voucherNumber,
      fiscalYear,
      channel,
      voucherDate: Timestamp.fromDate(now),
      paymentMode: input.paymentMode,
      paymentRef: input.paymentRef,
      orderNumber: settlement.orderId!,
      customerInvoiceNumber,
      payer,
      payee,
      artwork: {
        id: order.artworkId,
        title: artwork.title,
        medium: artwork.medium ?? null,
        hsn: "9701",
      },
      soldViaAggregator: input.soldViaAggregator ?? null,
      amounts: {
        artistPayoutShare: settlementMath.gross,
        tds: settlementMath.tdsDeduction,
        platformFacilitation:
          channel === "marketplace"
            ? Math.max(0, input.platformFacilitationPaise ?? 0)
            : 0,
        convenience: settlementMath.convenienceDeduction,
        convenienceGst: convGst,
        technology: settlementMath.technologyDeduction,
        technologyGst: techGst,
        otherCharges: settlementMath.otherChargesDeduction,
        otherChargesGst: otherGst,
        delivery: settlementMath.deliveryDeduction,
        rcmGst: 0,
        netPayable: settlementMath.net,
      },
      intraState,
      issuedAt: Timestamp.fromDate(now),
    };

    tx.set(counterRef, { fiscalYear, nextSeq }, { merge: true });
    tx.update(orderRef, { purchaseBill: snapshot });
    return voucherNumber;
  });

  const refreshed = (await orderRef.get()).data() as OrderDoc | undefined;
  if (!refreshed?.purchaseBill) {
    throw new PurchaseBillError(
      `Voucher ${number} stamped but not readable back from order ${settlement.orderId}`,
    );
  }
  return refreshed.purchaseBill;
}
