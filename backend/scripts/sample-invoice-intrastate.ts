// Intra-state sample invoice — buyer in Telangana (same state as the
// "Billed by" seller GalleryZone), so the 5% GST splits into CGST 2.5%
// + SGST 2.5% instead of a single IGST line.
//
// Mirrors scripts/sample-invoice.ts (inter-state) in every other field
// so a reviewer can diff the two renders side-by-side and see only
// what changes with the state.
//
// Run from `backend/`:
//   node --experimental-strip-types scripts/sample-invoice-intrastate.ts

import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Timestamp } from "firebase-admin/firestore";
import { renderInvoicePdf } from "../apps/api/src/invoice-pdf.ts";
import type { OrderDoc, InvoiceSnapshot, InvoiceLine } from "@galleryzone/db";

const order: OrderDoc & { id: string } = {
  id: "ord_SAMPLE_INTRASTATE_01",
  artworkId: "art_sample_hyd_cityscape_01",
  customerId: "cus_sample_hyd",
  addressId: "addr_sample_hyd",
  displayPricePaise: 52500_00,
  gstPaise: 2500_00, // 5% artwork GST inside displayPrice
  deliveryChargePaise: 245_00,
  convenienceFeePaise: 1055_00,
  convenienceGstPaise: 190_00,
  totalPaise: 52500_00 + 1055_00 + 190_00 + 245_00,
  status: "paid",
  rateConfigVersionId: "rcv_live_01",
  artistId: "art_sample_rahul",
  artistPricePaise: 40000_00,
  createdAt: Timestamp.fromDate(new Date("2026-11-17T10:30:00.000Z")),
};

// Half-splitter mirrors the stamp logic in packages/db/src/invoices.ts
// so the rounding remainder (if any) lands on sgstPaise and the two
// halves add back up to the total exactly.
const totalArtGst = order.gstPaise;
const cgstPaise = Math.floor(totalArtGst / 2);
const sgstPaise = totalArtGst - cgstPaise;
const artworkTaxable = order.displayPricePaise - order.gstPaise;

const lines: InvoiceLine[] = [
  {
    description: "Charminar at Dusk",
    hsnOrSac: "9701",
    qty: 1,
    unitPricePaise: artworkTaxable,
    taxablePaise: artworkTaxable,
    gstRatePercent: 5,
    cgstPaise,
    sgstPaise,
  },
  {
    // Payment gateway fee carries 18% service GST but we present it as
    // a single "including tax" row — so no cgst/sgst fields here, the
    // Tax columns on the row show nil, and the gross value is on the
    // unit-price cell.
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
  number: "GZ/26-27/000143",
  fiscalYear: "FY2026-27",
  // Billed by — pulled from Railway's INVOICE_SELLER_* env vars so this
  // sample tracks the real production identity.
  seller: {
    legalName: "GalleryZone Private Limited",
    addressLine1: "H.No 5-117",
    addressLine2: "Sangareddy, Annaram, Gummadidala",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "502313",
    gstin: "36AANCG3346D1ZN",
    stateCode: "TS",
  },
  // Sold By — the artist. Rahul Verma, Hyderabad (Telangana).
  soldBy: {
    legalName: "Rahul Verma",
    addressLine1: "4-32, Banjara Hills Road No. 12",
    addressLine2: null,
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500034",
    stateCode: "TS",
    numericCode: "36",
    pan: "ABFPV5678K",
    gstin: "36ABFPV5678K1ZR",
  },
  // Intra-state → buyer must share seller state (Telangana). So this
  // buyer sits in Hyderabad; CGST + SGST will split 50/50 on the art
  // line.
  buyer: {
    name: "Keerthana Rao",
    addressLine1: "Plot 14, Jubilee Hills",
    addressLine2: "Road No. 36",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500033",
    gstin: null,
  },
  orderNumber: order.id,
  orderDate: order.createdAt,
  payment: {
    transactionId: "pay_QqRsTtUu87654321",
    method: "UPI",
    paidAt: Timestamp.fromDate(new Date("2026-11-17T10:34:58.000Z")),
  },
  // Intra-state → CGST + SGST halves. Each half mirrors the per-line
  // split the renderer will show, so this top-level number equals the
  // sum of the per-line cgst/sgst cells.
  taxBreakdown: {
    kind: "intra_state",
    cgstPaise,
    sgstPaise,
  },
  lines,
  usesUtgst: false,
  placeOfSupply: { state: "Telangana", numericCode: "36", code: "TS" },
  placeOfDelivery: { state: "Telangana", numericCode: "36", code: "TS" },
  issuedAt: Timestamp.fromDate(new Date("2026-11-17T10:35:00.000Z")),
};

const pdf = await renderInvoicePdf({
  order,
  invoice,
  artworkTitle: "Charminar at Dusk",
});

const outPath = join(
  homedir(),
  "Desktop",
  "galleryzone-sample-invoice-intrastate.pdf",
);
writeFileSync(outPath, pdf);
console.log(`wrote ${pdf.length} bytes → ${outPath}`);
