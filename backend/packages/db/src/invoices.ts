// Tax-invoice snapshots and sequential invoice numbering — audit §9.
//
// An Indian GST tax invoice must carry a stable, sequential invoice number
// per supplier per fiscal year (CGST Rules, 46). We allocate the number
// inside a Firestore transaction against invoiceCounters/{fiscalYear}, then
// freeze the full snapshot (seller, buyer, tax split) onto the order doc so
// re-renders can't drift. Once stamped, the snapshot is never rewritten.

import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import {
  Collections,
  userProfileCol,
  type AddressDoc,
  type InvoiceCounterDoc,
  type InvoiceLine,
  type InvoiceSnapshot,
  type OrderDoc,
  type ProfileDoc,
  type UserDoc,
} from "./collections.ts";
import { DbError } from "./errors.ts";
import { findIndianState } from "./india-states.ts";

export class InvoiceError extends DbError {}

/** IST is UTC+5:30 year-round — India has no daylight saving. */
const IST_OFFSET_MINUTES = 330;

/**
 * Indian fiscal year — Apr 1 to Mar 31. "FY2026-27" is Apr 2026 → Mar 2027.
 *
 * Decided in IST, not in the server's zone: the fiscal year of a GST invoice
 * is a fact about the Indian calendar, and this API runs on UTC. Reading the
 * local date would file an order paid in the first 5.5 hours of 1 April IST
 * under the previous fiscal year.
 */
export function fiscalYearOf(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
  const year = ist.getUTCFullYear();
  const startYear = ist.getUTCMonth() >= 3 ? year : year - 1;
  return `FY${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** "GZ/26-27/000001" — short-year form, zero-padded 6-digit sequence. */
export function formatInvoiceNumber(fiscalYear: string, seq: number): string {
  const short = fiscalYear.replace(/^FY\d{2}/, "");
  return `GZ/${short}/${String(seq).padStart(6, "0")}`;
}

export interface SellerIdentity {
  legalName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  gstin: string | null;
  stateCode: string;
}

export interface InvoiceStampInput {
  orderId: string;
  seller: SellerIdentity;
  /** Shown on the artwork line of the invoice. Falls back to "Artwork"
   *  when the caller doesn't have the title handy — the invoice stays
   *  valid, just less descriptive. */
  artworkTitle?: string;
}

// --- Line-item vocabulary ---------------------------------------------------
//
// Tax-invoice rows carry (description, HSN/SAC, rate). Keeping these as
// named constants near the stamp logic rather than scattered through the
// renderer: the renderer should only *display* what the snapshot says,
// and the snapshot is what gets audited.

/** Chapter 97 heading 9701 — "Paintings, drawings and pastels, executed
 *  entirely by hand; collages and similar decorative plaques". 5% GST.
 *  We carry the 4-digit heading only (not the full 8-digit tariff)
 *  because that's what the client's GST ledger uses and matches the
 *  CBIC rate notification for Chapter 97 art. 20 Nov 2026 call. */
const HSN_ARTWORK = "9701";
/** Services auxiliary to financial services — the SAC Razorpay itself
 *  bills payment-gateway fees under. We're re-billing the buyer for the
 *  same service, so we carry the same code. 18% GST. */
const SAC_PAYMENT_GATEWAY = "997158";
/** Goods transport (road, by courier). Shown on the invoice at 0% —
 *  the buyer pays the courier's rate as a direct pass-through, no GST
 *  is added or collected by GalleryZone. 20 Nov 2026 client call. */
const SAC_SHIPPING = "996812";

/** Splits a total GST amount into intra-state halves, with the rounding
 *  remainder pinned to sgst so the two halves always sum to total exactly. */
function splitHalves(totalPaise: number): { cgstPaise: number; sgstPaise: number } {
  const cgstPaise = Math.floor(totalPaise / 2);
  return { cgstPaise, sgstPaise: totalPaise - cgstPaise };
}

/** Build one invoice line for a taxable row.
 *  - `preTaxPaise` is the taxable value for this line (qty × unit, pre-GST).
 *  - `gstPaise` is the total GST on that taxable value.
 *  - `isIntraState` decides CGST+SGST vs IGST. UT-vs-SGST labelling is
 *    handled at render time from `InvoiceSnapshot.usesUtgst`. */
function buildLine(args: {
  description: string;
  hsnOrSac: string;
  gstRatePercent: InvoiceLine["gstRatePercent"];
  preTaxPaise: number;
  gstPaise: number;
  isIntraState: boolean;
}): InvoiceLine {
  const line: InvoiceLine = {
    description: args.description,
    hsnOrSac: args.hsnOrSac,
    qty: 1,
    unitPricePaise: args.preTaxPaise,
    taxablePaise: args.preTaxPaise,
    gstRatePercent: args.gstRatePercent,
  };
  if (args.gstPaise <= 0) return line;
  if (args.isIntraState) {
    const { cgstPaise, sgstPaise } = splitHalves(args.gstPaise);
    line.cgstPaise = cgstPaise;
    line.sgstPaise = sgstPaise;
  } else {
    line.igstPaise = args.gstPaise;
  }
  return line;
}

/**
 * Returns the frozen invoice snapshot for an order. If the order has never
 * been invoiced, allocates a new number atomically and writes the snapshot
 * back to the order doc; otherwise returns what was stamped the first time.
 *
 * Rejected unless the order is actually paid — an invoice is proof of a
 * taxable supply, not of an intent to pay.
 */
export async function getOrCreateInvoice(
  db: Firestore,
  input: InvoiceStampInput,
): Promise<InvoiceSnapshot> {
  const orderRef = db.collection(Collections.orders).doc(input.orderId);

  // Fast path — already stamped. A separate read first keeps us out of the
  // transaction (and off the counter) when the snapshot exists.
  const existing = (await orderRef.get()).data() as OrderDoc | undefined;
  if (!existing) throw new InvoiceError(`No order ${input.orderId}`);
  if (!isInvoiceable(existing.status)) {
    throw new InvoiceError(
      `Order ${input.orderId} is ${existing.status}; invoice is only issued once paid.`,
    );
  }
  if (existing.invoice) return existing.invoice;

  // Look up every stamp-time read in parallel. Artist + payment are
  // optional because older orders predate `artistId` on OrderDoc and a
  // simulated / pre-capture payment doc may lack the Razorpay bits.
  const artistId = existing.artistId ?? null;
  const [
    customerSnap,
    addressSnap,
    buyerProfileSnap,
    artistUserSnap,
    artistProfileSnap,
    paymentSnap,
  ] = await Promise.all([
    db.collection(Collections.users).doc(existing.customerId).get(),
    db.collection(Collections.addresses).doc(existing.addressId).get(),
    db.collection(userProfileCol(existing.customerId)).doc("data").get(),
    artistId
      ? db.collection(Collections.users).doc(artistId).get()
      : Promise.resolve(null),
    artistId
      ? db.collection(userProfileCol(artistId)).doc("data").get()
      : Promise.resolve(null),
    // There's exactly one PaymentDoc per order (idempotency-keyed), but
    // the doc id is the idempotency key, not the order id, so we query.
    // Prefer a captured row over a pending one when both exist.
    db
      .collection(Collections.payments)
      .where("orderId", "==", input.orderId)
      .limit(5)
      .get(),
  ]);
  const customer = customerSnap.data() as UserDoc | undefined;
  const address = addressSnap.data() as AddressDoc | undefined;
  const buyerProfile = buyerProfileSnap.data() as ProfileDoc | undefined;
  if (!customer || !address) {
    throw new InvoiceError(`Missing buyer or address for order ${input.orderId}`);
  }
  const buyerGstin = buyerProfile?.gstin?.trim() || null;

  const artistUser = artistUserSnap?.data() as UserDoc | undefined;
  const artistProfile = artistProfileSnap?.data() as ProfileDoc | undefined;
  const artistStateMeta = findIndianState(artistProfile?.pickupState);
  const soldBy: InvoiceSnapshot["soldBy"] | undefined =
    artistId && artistUser && artistProfile
      ? {
          legalName: artistUser.name ?? "Artist",
          addressLine1: artistProfile.pickupLine1 ?? "",
          addressLine2: artistProfile.pickupLine2 ?? null,
          city: artistProfile.pickupCity ?? "",
          state: artistProfile.pickupState ?? "",
          pincode: artistProfile.pickupPincode ?? "",
          stateCode: artistStateMeta?.code ?? "",
          numericCode: artistStateMeta?.numericCode ?? "",
          pan: artistProfile.pan?.trim() || null,
          // Rule: only print a GSTIN if the artist has one saved on their
          // profile. Blank entirely when absent, per 20 Nov 2026 client
          // call — unregistered artists must not show a GST line at all.
          gstin: artistProfile.gstin?.trim() || null,
        }
      : undefined;

  // Pick the best-available payment capture row. The webhook flips a
  // row from "pending" to "captured"; we want the captured one.
  type PaymentRow = {
    providerPaymentId?: string | null;
    method?: string | null;
    createdAt?: FirebaseFirestore.Timestamp;
    status?: string;
  };
  const paymentRows = paymentSnap.docs.map((d) => d.data() as PaymentRow);
  const paymentRow =
    paymentRows.find((p) => p.status === "captured" || p.status === "paid") ??
    paymentRows[0];
  const payment: InvoiceSnapshot["payment"] | undefined = paymentRow
    ? {
        transactionId: paymentRow.providerPaymentId ?? null,
        method: paymentRow.method ?? null,
        paidAt: paymentRow.createdAt ?? null,
      }
    : undefined;

  // Intra-state vs inter-state: compare on the normalized state name so a
  // mismatch between "Karnataka"/"KARNATAKA"/"karnataka " doesn't flip the tax
  // split. The seller config carries the full state name too, so the compare
  // is name-vs-name — no fragile state-code mapping needed.
  const isIntraState =
    normalizeState(address.state) === normalizeState(input.seller.state);

  // UTGST only kicks in when the *seller* is in a union territory without
  // its own legislature. For GalleryZone (Telangana) this is never true,
  // but the flag is on the snapshot so a later move to Chandigarh /
  // Ladakh / A&N / Lakshadweep / DN&DD doesn't need a code change — just
  // a config change and a re-stamp.
  const sellerStateMeta = findIndianState(input.seller.state);
  const usesUtgst = isIntraState && !!sellerStateMeta?.isUtWithoutLegislature;

  // Build line items. Each row carries its own taxable value + GST so the
  // renderer can show per-line CGST/SGST/IGST and per-line rate columns
  // (Rule 46 compliance).
  const lines: InvoiceLine[] = [];

  // Line 1 — Artwork. displayPricePaise is GST-inclusive (price ladder in
  // packages/domain/src/pricing.ts stacks 5% on top). gstPaise is the
  // extracted 5% portion. Taxable value is pre-tax display price.
  const artworkTaxable = existing.displayPricePaise - existing.gstPaise;
  lines.push(
    buildLine({
      description: input.artworkTitle?.trim() || "Artwork",
      hsnOrSac: HSN_ARTWORK,
      gstRatePercent: 5,
      preTaxPaise: artworkTaxable,
      gstPaise: existing.gstPaise,
      isIntraState,
    }),
  );

  // Line 2 — Payment-gateway charge. Shown as a single gross-price row
  // ("including tax") per client direction 20 Nov 2026: the buyer sees
  // the 2% + 18% service GST bundled into one number; the invoice's
  // Tax Rate / Tax Type / Tax Amount columns on this row read "nil",
  // because the GST isn't itemised here. We still collected the GST
  // and still remit it — the breakdown just doesn't appear on the
  // customer-facing invoice. Skip entirely when the fee is zero.
  if (existing.convenienceFeePaise > 0) {
    const pgGross = existing.convenienceFeePaise + existing.convenienceGstPaise;
    lines.push({
      description: "Payment gateway charge",
      hsnOrSac: SAC_PAYMENT_GATEWAY,
      qty: 1,
      unitPricePaise: pgGross,
      taxablePaise: pgGross,
      gstRatePercent: 18,
    });
  }

  // Line 3 — Shipping. We don't track a separate shippingGstPaise on the
  // order: the courier (Shiprocket) invoices us directly and we pass the
  // amount through to the buyer as pure-agent reimbursement (CGST Rule
  // 33). The invoice shows the pass-through amount at 0% so the row
  // appears for transparency but doesn't double-count GST. If the client
  // later wants composite-supply treatment at 5% or 18%, flip the rate
  // and start capturing a shipping GST column at checkout time.
  if (existing.deliveryChargePaise > 0) {
    lines.push(
      buildLine({
        description: "Shipping charges",
        hsnOrSac: SAC_SHIPPING,
        gstRatePercent: 0,
        preTaxPaise: existing.deliveryChargePaise,
        gstPaise: 0,
        isIntraState,
      }),
    );
  }

  // Grand totals match sum-of-lines exactly — the half-split rounding was
  // already applied per line, so adding them back up here can't drift.
  const taxBreakdown: InvoiceSnapshot["taxBreakdown"] = isIntraState
    ? {
        kind: "intra_state",
        cgstPaise: lines.reduce((s, l) => s + (l.cgstPaise ?? 0), 0),
        sgstPaise: lines.reduce((s, l) => s + (l.sgstPaise ?? 0), 0),
      }
    : {
        kind: "inter_state",
        igstPaise: lines.reduce((s, l) => s + (l.igstPaise ?? 0), 0),
      };

  // Place of supply (goods): location of delivery = the buyer's state.
  const buyerStateMeta = findIndianState(address.state);
  const placeOfSupply = buyerStateMeta
    ? {
        state: buyerStateMeta.name,
        numericCode: buyerStateMeta.numericCode,
        code: buyerStateMeta.code,
      }
    : undefined;

  const now = new Date();
  const fiscalYear = fiscalYearOf(now);
  const counterRef = db.collection(Collections.invoiceCounters).doc(fiscalYear);

  const number = await db.runTransaction(async (tx) => {
    // Re-check inside the tx — a parallel request may have stamped it by now.
    const orderInTx = (await tx.get(orderRef)).data() as OrderDoc | undefined;
    if (orderInTx?.invoice) return orderInTx.invoice.number;

    const counterSnap = await tx.get(counterRef);
    const seq =
      ((counterSnap.data() as InvoiceCounterDoc | undefined)?.nextSeq ?? 1);
    const nextSeq = seq + 1;
    const invoiceNumber = formatInvoiceNumber(fiscalYear, seq);
    const snapshot: InvoiceSnapshot = {
      number: invoiceNumber,
      fiscalYear,
      seller: input.seller,
      buyer: {
        name: customer.name,
        addressLine1: address.line1,
        addressLine2: address.line2 ?? null,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        gstin: buyerGstin,
      },
      ...(soldBy ? { soldBy } : {}),
      orderNumber: input.orderId,
      orderDate: existing.createdAt,
      ...(payment ? { payment } : {}),
      // For goods, place of delivery equals the buyer's shipping-state —
      // identical to placeOfSupply today. Kept as its own field so a
      // future bill-to vs ship-to divergence can be printed separately.
      ...(placeOfSupply ? { placeOfDelivery: placeOfSupply } : {}),
      taxBreakdown,
      lines,
      usesUtgst,
      ...(placeOfSupply ? { placeOfSupply } : {}),
      issuedAt: Timestamp.fromDate(now),
    };
    tx.set(counterRef, { fiscalYear, nextSeq }, { merge: true });
    tx.update(orderRef, { invoice: snapshot });
    return invoiceNumber;
  });

  // Re-read to return the full snapshot — the transaction only yielded the
  // number so the counter row stays small.
  const refreshed = (await orderRef.get()).data() as OrderDoc | undefined;
  if (!refreshed?.invoice) {
    throw new InvoiceError(`Invoice ${number} stamped but not readable back.`);
  }
  return refreshed.invoice;
}

/**
 * Which order states carry a valid tax invoice. "paid" and anything beyond
 * (shipped, delivered) — a cancelled or still-unpaid order has nothing to
 * invoice yet.
 */
function isInvoiceable(status: OrderDoc["status"]): boolean {
  return (
    status === "paid" ||
    status === "confirmed" ||
    status === "packed" ||
    status === "transit" ||
    status === "delivered"
  );
}

function normalizeState(state: string | null | undefined): string {
  return (state ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
