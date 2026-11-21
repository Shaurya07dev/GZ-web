// Delivery-challan format-stability guard.
//
// Run from `backend/`:
//   node --experimental-strip-types apps/api/src/delivery-challan-pdf.check.ts

import assert from "node:assert/strict";
import {
  DeliveryChallanPageOverflowError,
  renderDeliveryChallanPdf,
  type DeliveryChallanSnapshot,
} from "./delivery-challan-pdf.ts";

function base(
  overrides: Partial<DeliveryChallanSnapshot> = {},
): DeliveryChallanSnapshot {
  return {
    number: "GZ/DC/2026-27/000001",
    fiscalYear: "FY2026-27",
    challanDate: new Date("2026-11-21T09:30:00.000Z"),
    copyLabel: "Original",
    reason: "exhibition_display",
    returnDeadline: new Date("2027-05-21T00:00:00.000Z"),
    currentDeadline: new Date("2026-12-21T00:00:00.000Z"),
    ewayBill: { number: null, generatedAt: null, validUntil: null },
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
        artistValuePaise: 40000_00,
        provisionalValuePaise: 52000_00,
      },
    ],
    ...overrides,
  };
}

function countPages(pdf: Buffer): number {
  const text = pdf.toString("latin1");
  const m = text.match(/\/Type\s*\/Page(?!s)/g);
  return m ? m.length : 0;
}

// 1. Baseline (display).
{
  const pdf = await renderDeliveryChallanPdf(base());
  assert.equal(countPages(pdf), 1, "baseline: 1 page");
}

// 2. With real EWB.
{
  const pdf = await renderDeliveryChallanPdf(
    base({
      ewayBill: {
        number: "123456789012",
        generatedAt: new Date("2026-11-21T09:35:00.000Z"),
        validUntil: new Date("2026-11-22T09:35:00.000Z"),
      },
    }),
  );
  assert.equal(countPages(pdf), 1, "with EWB: 1 page");
}

// 3. Return leg.
{
  const pdf = await renderDeliveryChallanPdf(
    base({
      reason: "return_of_goods",
      returnDeadline: null,
      currentDeadline: null,
    }),
  );
  assert.equal(countPages(pdf), 1, "return leg: 1 page");
}

// 4. Multi-item fixture (unlikely but possible for sheet/series sales).
{
  const items = Array.from({ length: 3 }).map((_, i) => ({
    artworkId: `ART-SERIES-${String(i + 1).padStart(3, "0")}`,
    title: `Series Piece ${i + 1}`,
    artistName: "Devika Nair",
    medium: "Acrylic on canvas, 12\" × 16\"",
    hsn: "9701",
    qty: 1,
    unit: "No.",
    artistValuePaise: (10000 + i * 5000) * 100,
    provisionalValuePaise: (13000 + i * 6500) * 100,
  }));
  const pdf = await renderDeliveryChallanPdf(base({ items }));
  assert.equal(countPages(pdf), 1, "multi-item: 1 page");
}

// 5. Overflow guard.
{
  const err = new DeliveryChallanPageOverflowError(2);
  assert.equal(err.name, "DeliveryChallanPageOverflowError");
}

console.log(
  "apps/api/delivery-challan-pdf.ts: baseline, with-EWB, return, multi-item stayed at 1 page + overflow guard exported",
);
