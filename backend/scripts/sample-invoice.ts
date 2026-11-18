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
import type { OrderDoc, InvoiceSnapshot } from "@galleryzone/db";

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

const invoice: InvoiceSnapshot = {
  number: "GZ/26-27/000142",
  fiscalYear: "FY2026-27",
  seller: {
    legalName: "GalleryZone Private Limited",
    addressLine1: "ESTANCIA TOWER 1, Potheri",
    addressLine2: "SRM Nagar, Kattankulathur",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "603202",
    gstin: "33AAICG1234F1Z5",
    stateCode: "TN",
  },
  buyer: {
    name: "Arjun Mehta",
    addressLine1: "B-704, Oberoi Splendor",
    addressLine2: "JVLR, Jogeshwari East",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400060",
  },
  // Inter-state (TN → MH) → IGST only. GST inside artwork ₹2,500 + 18% of
  // convenience ₹190 = 2,690. Rounding into whole paise.
  taxBreakdown: { kind: "inter_state", igstPaise: 2690_00 },
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
