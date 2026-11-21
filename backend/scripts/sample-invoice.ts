// Generates a sample GalleryZone tax invoice PDF with fake data, writes it
// to ~/Desktop/galleryzone-sample-invoice.pdf so the owner can preview what
// buyers receive with their parcel.
//
// This uses the same renderer the real invoice endpoint uses
// (apps/api/src/invoice-pdf.ts) — pixel-for-pixel identical to production.
//
// Run from `backend/`:
//   node --experimental-strip-types scripts/sample-invoice.ts

import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Timestamp } from "firebase-admin/firestore";
import { renderInvoicePdf } from "../apps/api/src/invoice-pdf.ts";
import type { OrderDoc, InvoiceSnapshot, InvoiceLine } from "@galleryzone/db";

const order: OrderDoc & { id: string } = {
  id: "ord_SAMPLE_ABC123XYZ",
  artworkId: "art_sample_monsoon_01",
  customerId: "cus_sample",
  addressId: "addr_sample",
  // All amounts in paise. ₹52,500 artwork + GST inside.
  displayPricePaise: 52500_00,
  gstPaise: 2500_00, // 5% artwork GST inside displayPrice
  deliveryChargePaise: 245_00, // ₹245 courier
  convenienceFeePaise: 1055_00, // 2% of (displayPrice + delivery)
  convenienceGstPaise: 190_00, // 18% on convenience fee
  totalPaise: 52500_00 + 1055_00 + 190_00 + 245_00, // ₹53,990
  status: "paid",
  rateConfigVersionId: "rcv_live_01",
  artistId: "art_sample_devika",
  artistPricePaise: 40000_00,
  createdAt: Timestamp.fromDate(new Date("2026-11-17T10:30:00.000Z")),
};

// Per-line breakdown. Inter-state (TN → MH) means every GST amount is
// IGST; intra-state would split half CGST + half SGST (or UTGST).
const artworkTaxable = order.displayPricePaise - order.gstPaise; // ₹50,000
const lines: InvoiceLine[] = [
  {
    description: "Monsoon over the Deccan",
    hsnOrSac: "9701",
    qty: 1,
    unitPricePaise: artworkTaxable,
    taxablePaise: artworkTaxable,
    gstRatePercent: 5,
    igstPaise: order.gstPaise,
  },
  {
    // Payment gateway charge is printed as a single "including tax"
    // gross-price row — tax columns read nil on this line. Gross =
    // base fee + 18% service GST = 1055 + 190 = 1245.
    description: "Payment gateway charge",
    hsnOrSac: "997158",
    qty: 1,
    unitPricePaise: order.convenienceFeePaise + order.convenienceGstPaise,
    taxablePaise: order.convenienceFeePaise + order.convenienceGstPaise,
    gstRatePercent: 18,
  },
  {
    description: "Shipping charges",
    hsnOrSac: "996812",
    qty: 1,
    unitPricePaise: order.deliveryChargePaise,
    taxablePaise: order.deliveryChargePaise,
    gstRatePercent: 0,
  },
];

const invoice: InvoiceSnapshot = {
  number: "GZ/26-27/000142",
  fiscalYear: "FY2026-27",
  // Billed by — pulled from Railway's INVOICE_SELLER_* env vars so this
  // sample tracks the real production identity. If the registered office
  // moves, update Railway and the next render here picks it up.
  seller: {
    legalName: "GalleryZone Private Limited",
    addressLine1: "H.No 5-117",
    addressLine2: "Sangareddy, Annaram, Gummadidala",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "502313",
    // Replace this with the real GSTIN before shipping any sample to a
    // reviewer. Telangana's GST state code is 36, so a valid number
    // starts with "36".
    gstin: "36AANCG3346D1ZN",
    stateCode: "TS",
  },
  // The actual artist who sold the piece. Fills the "Sold By" block on
  // the left. Artist is registered → both PAN and GSTIN print; if she
  // weren't GST-registered the GSTIN line would just be absent.
  soldBy: {
    legalName: "Devika Nair",
    addressLine1: "Studio 14, Fort Kochi",
    addressLine2: null,
    city: "Kochi",
    state: "Kerala",
    pincode: "682001",
    stateCode: "KL",
    numericCode: "32",
    pan: "ABCDE1234F",
    gstin: "32ABCDE1234F1Z5",
  },
  buyer: {
    name: "Arjun Mehta",
    addressLine1: "B-704, Oberoi Splendor",
    addressLine2: "JVLR, Jogeshwari East",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400060",
    gstin: "27ABCDE1234F1Z5",
  },
  orderNumber: order.id,
  orderDate: order.createdAt,
  payment: {
    transactionId: "pay_PhAaBbCc12345678",
    method: "UPI",
    paidAt: Timestamp.fromDate(new Date("2026-11-17T10:34:58.000Z")),
  },
  // Inter-state (TN → MH) → IGST only. Only the itemised GST (art 5%)
  // lives in the breakdown; PG's 18% GST is already absorbed into the
  // "including tax" gross price shown on its own line.
  taxBreakdown: { kind: "inter_state", igstPaise: order.gstPaise },
  lines,
  usesUtgst: false,
  placeOfSupply: { state: "Maharashtra", numericCode: "27", code: "MH" },
  placeOfDelivery: { state: "Maharashtra", numericCode: "27", code: "MH" },
  issuedAt: Timestamp.fromDate(new Date("2026-11-17T10:35:00.000Z")),
};

const pdf = await renderInvoicePdf({
  order,
  invoice,
  artworkTitle: "Monsoon over the Deccan",
});

const outPath = join(homedir(), "Desktop", "galleryzone-sample-invoice.pdf");
writeFileSync(outPath, pdf);
console.log(`wrote ${pdf.length} bytes → ${outPath}`);
