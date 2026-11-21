// Sample aggregator commission tax invoice PDF — the self-invoice GZ
// generates on behalf of the aggregator for their tier share of the
// markup pool. Written to ~/Desktop.
//
// Run from `backend/`:
//   node --experimental-strip-types scripts/sample-aggregator-commission-invoice.ts

import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  renderAggregatorCommissionInvoicePdf,
  type AggregatorCommissionInvoiceSnapshot,
} from "../apps/api/src/aggregator-commission-invoice-pdf.ts";

// Sale: Listed Rs. 1,30,000 to the buyer, artist price Rs. 1,00,000 →
// markup pool Rs. 30,000. Aggregator on Tier 1 (20%) gets Rs. 6,000
// GST-inclusive. Breakdown: taxable 6,000 / 1.18 = Rs. 5,084.75, GST
// (intra-state Telangana→Telangana) = Rs. 915.25 split 457.63 CGST +
// 457.63 SGST. The halves get a +0.01 remainder which lands on SGST by
// the half-split convention.
const grossInclusive = 6000_00;
const taxable = Math.round((grossInclusive * 100) / 118);
const gst = grossInclusive - taxable;
const cgst = Math.floor(gst / 2);
const sgst = gst - cgst;

const snapshot: AggregatorCommissionInvoiceSnapshot = {
  number: "GZ/AC/2026-27/000042",
  fiscalYear: "FY2026-27",
  issuedAt: new Date("2026-11-21T10:30:00.000Z"),
  dueDate: new Date("2026-12-06T10:30:00.000Z"),
  servicePeriod: {
    from: new Date("2026-11-01T00:00:00.000Z"),
    to: new Date("2026-11-15T23:59:59.000Z"),
  },
  aggregator: {
    legalName: "Art Fair Hyderabad LLP",
    addressLine1: "Plot 14, Jubilee Hills Road No. 36",
    addressLine2: "Opp. Peddamma Temple",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500033",
    stateCode: "TS",
    numericCode: "36",
    phone: "+91 98480 55566",
    email: "hello@artfairhyderabad.in",
    pan: "ABCFH4567K",
    gstin: "36ABCFH4567K1ZQ",
  },
  billedTo: {
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
  sale: {
    artworkId: "ART-000287",
    artworkTitle: "Charminar at Dusk",
    artistName: "Rahul Verma",
    medium: "Oil on canvas, 24\" × 36\"",
    customerInvoiceNumber: "GZ/26-27/000143",
    saleDate: new Date("2026-11-07T14:00:00.000Z"),
    listedSellingPaise: 130000_00,
    artistPaise: 100000_00,
  },
  commercialShare: {
    tier: 1,
    tierPercent: 20,
    markupPoolPaise: 30000_00,
    grossInclusivePaise: grossInclusive,
  },
  taxBreakdown: {
    kind: "intra_state",
    taxablePaise: taxable,
    cgstPaise: cgst,
    sgstPaise: sgst,
    ratePercent: 18,
  },
  // Toggle to null to see the "Pending acceptance" variant.
  acceptance: {
    acceptedAt: new Date("2026-11-21T11:04:12.000Z"),
    acceptedByIp: "49.207.221.86",
    acceptedByUserAgent: "Mozilla/5.0 (Macintosh; Chrome/129.0)",
  },
};

const pdf = await renderAggregatorCommissionInvoicePdf(snapshot);
const out = join(
  homedir(),
  "Desktop",
  "galleryzone-sample-aggregator-commission-invoice.pdf",
);
writeFileSync(out, pdf);
console.log(`wrote ${pdf.length} bytes → ${out}`);
