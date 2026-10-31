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
  type AddressDoc,
  type InvoiceCounterDoc,
  type InvoiceSnapshot,
  type OrderDoc,
  type UserDoc,
} from "./collections.ts";
import { DbError } from "./errors.ts";

export class InvoiceError extends DbError {}

/** Indian fiscal year — Apr 1 to Mar 31. "FY2026-27" is Apr 2026 → Mar 2027. */
export function fiscalYearOf(date: Date): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `FY${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** "GZ/26-27/000001" — short-year form, zero-padded 6-digit sequence. */
function formatInvoiceNumber(fiscalYear: string, seq: number): string {
  const short = fiscalYear.replace(/^FY\d{2}/, "");
  return `GZ/${fiscalYear.slice(4, 6)}${short}/${String(seq).padStart(6, "0")}`;
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

  // Look up buyer + address outside the transaction (reads first).
  const [customerSnap, addressSnap] = await Promise.all([
    db.collection(Collections.users).doc(existing.customerId).get(),
    db.collection(Collections.addresses).doc(existing.addressId).get(),
  ]);
  const customer = customerSnap.data() as UserDoc | undefined;
  const address = addressSnap.data() as AddressDoc | undefined;
  if (!customer || !address) {
    throw new InvoiceError(`Missing buyer or address for order ${input.orderId}`);
  }

  // Intra-state vs inter-state: compare on the normalized state name so a
  // mismatch between "Karnataka"/"KARNATAKA"/"karnataka " doesn't flip the tax
  // split. The seller config carries the full state name too, so the compare
  // is name-vs-name — no fragile state-code mapping needed.
  const isIntraState =
    normalizeState(address.state) === normalizeState(input.seller.state);

  const totalGst = existing.gstPaise + existing.convenienceGstPaise;
  const taxBreakdown: InvoiceSnapshot["taxBreakdown"] = isIntraState
    ? {
        kind: "intra_state",
        cgstPaise: Math.floor(totalGst / 2),
        // Any paise rounding-remainder goes on sgst so the two halves still
        // sum to totalGst exactly.
        sgstPaise: totalGst - Math.floor(totalGst / 2),
      }
    : { kind: "inter_state", igstPaise: totalGst };

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
      },
      taxBreakdown,
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
