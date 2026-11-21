// Sample delivery challan PDF for an artist → aggregator display leg,
// with E-Way Bill fields left as "NA" placeholder (we add ClearTax
// integration later in Phase 2). Written to ~/Desktop.
//
// Run from `backend/`:
//   node --experimental-strip-types scripts/sample-delivery-challan.ts

import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  renderDeliveryChallanPdf,
  type DeliveryChallanSnapshot,
} from "../apps/api/src/delivery-challan-pdf.ts";

const snapshot: DeliveryChallanSnapshot = {
  number: "GZ/DC/2026-27/000042",
  fiscalYear: "FY2026-27",
  challanDate: new Date("2026-11-21T09:30:00.000Z"),
  copyLabel: "Original",
  reason: "exhibition_display",
  returnDeadline: new Date("2027-05-21T00:00:00.000Z"), // 6 months out
  currentDeadline: new Date("2026-12-21T00:00:00.000Z"), // 30-day placement
  ewayBill: {
    // Below ₹50k threshold, no EWB needed — will show "NA". Flip this
    // to a real 12-digit number when consignment > threshold.
    number: null,
    generatedAt: null,
    validUntil: null,
  },
  transport: {
    mode: "Courier",
    transporterName: "Shiprocket (via Delhivery)",
    vehicleOrDocket: "SR AWB 1234567890",
  },
  consignor: {
    legalName: "GalleryZone Private Limited",
    addressLine1: "H.No 5-117, Ashu Nivas",
    addressLine2: "Annaram, Gummadidala, Sangareddy",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "502313",
    stateCode: "TS",
    gstin: "36AANCG3346D1ZN",
  },
  dispatchedFrom: {
    // Pickup = artist's studio (Devika Nair, Kochi).
    legalName: "Devika Nair (Artist Studio)",
    addressLine1: "Studio 14, Fort Kochi",
    addressLine2: null,
    city: "Kochi",
    state: "Kerala",
    pincode: "682001",
    stateCode: "KL",
    gstin: null,
  },
  consignee: {
    // Drop = Art Fair Hyderabad aggregator.
    legalName: "Art Fair Hyderabad LLP",
    addressLine1: "Plot 14, Jubilee Hills Road No. 36",
    addressLine2: "Opp. Peddamma Temple",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500033",
    stateCode: "TS",
    gstin: "36ABCFH4567K1ZQ",
  },
  items: [
    {
      artworkId: "ART-000042",
      title: "Backwaters at Twilight",
      artistName: "Devika Nair",
      medium: "Oil on canvas, 24\" × 36\"",
      hsn: "9701",
      qty: 1,
      unit: "No.",
      artistValuePaise: 40000_00, // artist's own price
      provisionalValuePaise: 52000_00, // artist + GZ markup, for EWB value
    },
  ],
  notes:
    "Fragile — do not stack. Original frame included; display with wall anchor only, not freestanding.",
};

const pdf = await renderDeliveryChallanPdf(snapshot);
const out = join(homedir(), "Desktop", "galleryzone-sample-delivery-challan.pdf");
writeFileSync(out, pdf);
console.log(`wrote ${pdf.length} bytes → ${out}`);
