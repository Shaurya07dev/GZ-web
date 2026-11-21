// Sample aggregator-channel purchase-cum-payment bill PDF, written to
// ~/Desktop. Mirrors the marketplace variant but adds Convenience +
// Technology deductions that only apply on aggregator-channel sales.
//
// Run from `backend/`:
//   node --experimental-strip-types scripts/sample-purchase-bill-aggregator.ts

import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  renderPurchaseBillPdf,
  type PurchaseBillSnapshot,
} from "../apps/api/src/purchase-bill-pdf.ts";

const snapshot: PurchaseBillSnapshot = {
  number: "GZ/PV/2026-27/000143",
  fiscalYear: "FY2026-27",
  channel: "aggregator",
  voucherDate: new Date("2026-11-17T10:35:00.000Z"),
  paymentRef: "AXIS26H042115812",
  paymentMode: "NEFT",
  orderNumber: "ord_SAMPLE_AGG_XYZ789",
  customerInvoiceNumber: "GZ/26-27/000143",
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
    fullName: "Rahul Verma",
    addressLine1: "4-32, Banjara Hills Road No. 12",
    addressLine2: null,
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500034",
    pan: "ABFPV5678K",
    phone: "+91 98480 55566",
    gstStatus: "Unregistered (Below Threshold)",
  },
  artwork: {
    id: "ART-000287",
    title: "Charminar at Dusk",
    medium: "Oil on canvas, 24\" × 36\"",
    hsn: "9701",
  },
  soldViaAggregator: "Art Fair Hyderabad (Jubilee Hills venue)",
  // Payer (GZ) in Telangana, payee (artist Rahul Verma) in Telangana →
  // intra-state service supply → CGST 9% + SGST 9% split on each fee.
  intraState: true,
  // Aggregator channel math — mirrors packages/domain/src/pricing.ts
  // artistSettlementOf() exactly, with GST shown INLINE per fee row:
  //   Artist price           1,00,000
  //   − TDS 0.1%                 −100   (§194-O, sample is above ₹5L)
  //   − Convenience 2% + GST   −2,360   (SAC 998599; 2,000 + 360 service GST)
  //   − Technology 1% + GST    −1,180   (SAC 998319; 1,000 + 180 service GST)
  //   − Delivery               −2,000   (artist→aggregator leg, zero-tax)
  //   ─────────────────────
  //   Net payable             94,360
  amounts: {
    artistPayoutShare: 100000_00,
    tds: 100_00,
    platformFacilitation: 0,
    convenience: 2000_00,
    convenienceGst: 360_00, // 18% × 2,000
    technology: 1000_00,
    technologyGst: 180_00, // 18% × 1,000
    otherCharges: 0,
    otherChargesGst: 0,
    delivery: 2000_00,
    rcmGst: 0,
    netPayable: 94360_00,
  },
};

const pdf = await renderPurchaseBillPdf(snapshot);
const out = join(
  homedir(),
  "Desktop",
  "galleryzone-sample-purchase-bill-aggregator.pdf",
);
writeFileSync(out, pdf);
console.log(`wrote ${pdf.length} bytes → ${out}`);
