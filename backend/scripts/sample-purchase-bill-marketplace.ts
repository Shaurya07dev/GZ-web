// Sample marketplace-channel purchase-cum-payment bill PDF, written to
// ~/Desktop so the owner can preview how artist payouts look.
//
// Run from `backend/`:
//   node --experimental-strip-types scripts/sample-purchase-bill-marketplace.ts

import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  renderPurchaseBillPdf,
  type PurchaseBillSnapshot,
} from "../apps/api/src/purchase-bill-pdf.ts";

const snapshot: PurchaseBillSnapshot = {
  number: "GZ/PV/2026-27/000142",
  fiscalYear: "FY2026-27",
  channel: "marketplace",
  voucherDate: new Date("2026-11-17T10:35:00.000Z"),
  paymentRef: "AXIS26H042115700",
  paymentMode: "NEFT",
  orderNumber: "ord_SAMPLE_ABC123XYZ",
  customerInvoiceNumber: "GZ/26-27/000142",
  payer: {
    legalName: "GalleryZone Private Limited",
    addressLine1: "H.No 5-117, Ashu Nivas",
    addressLine2: "Annaram, Gummadidala, Sangareddy",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "502313",
    gstin: "36AANCG3346D1ZN",
    stateCode: "TS",
    pan: "AANCG3346D",
  },
  payee: {
    fullName: "Devika Nair",
    addressLine1: "Studio 14, Fort Kochi",
    addressLine2: null,
    city: "Kochi",
    state: "Kerala",
    pincode: "682001",
    pan: "ABCDE1234F",
    phone: "+91 98470 12345",
    gstStatus: "Unregistered (Below Threshold)",
  },
  artwork: {
    id: "ART-000142",
    title: "Monsoon over the Deccan",
    medium: "Acrylic on canvas, 30\" × 40\"",
    hsn: "9701",
  },
  // Marketplace channel pays the artist 100% of their quoted price —
  // GalleryZone takes NOTHING from the artist on this channel. The only
  // possible deduction is §194-O TDS if the artist has crossed ₹5L in
  // the financial year; this sample is below threshold so TDS = 0.
  // Payer (GZ) in Telangana, payee (artist Devika Nair) in Kerala —
  // if any aggregator-side charges existed they'd be inter-state → IGST.
  // Marketplace channel = no service fees so the flag is moot but still required.
  intraState: false,
  amounts: {
    artistPayoutShare: 40000_00,
    tds: 0,
    platformFacilitation: 0,
    convenience: 0,
    convenienceGst: 0,
    technology: 0,
    technologyGst: 0,
    otherCharges: 0,
    otherChargesGst: 0,
    delivery: 0,
    rcmGst: 0,
    netPayable: 40000_00,
  },
};

const pdf = await renderPurchaseBillPdf(snapshot);
const out = join(
  homedir(),
  "Desktop",
  "galleryzone-sample-purchase-bill-marketplace.pdf",
);
writeFileSync(out, pdf);
console.log(`wrote ${pdf.length} bytes → ${out}`);
