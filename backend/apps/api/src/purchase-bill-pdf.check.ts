// Purchase-bill format-stability guard. Renders both channel variants
// + stress fixtures and asserts each stays exactly one A4 page.
//
// Run from `backend/`:
//   node --experimental-strip-types apps/api/src/purchase-bill-pdf.check.ts

import assert from "node:assert/strict";
import {
  PurchaseBillPageOverflowError,
  renderPurchaseBillPdf,
  type PurchaseBillSnapshot,
} from "./purchase-bill-pdf.ts";

function base(
  overrides: Partial<PurchaseBillSnapshot> = {},
): PurchaseBillSnapshot {
  return {
    number: "GZ/PV/2026-27/000001",
    fiscalYear: "FY2026-27",
    channel: "marketplace",
    voucherDate: new Date("2026-11-17T10:35:00.000Z"),
    paymentRef: "AXIS26H042115700",
    paymentMode: "NEFT",
    orderNumber: "ord_TEST_000001",
    customerInvoiceNumber: "GZ/26-27/000001",
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
      id: "ART-000001",
      title: "Monsoon over the Deccan",
      medium: "Acrylic on canvas, 30\" × 40\"",
      hsn: "9701",
    },
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
    ...overrides,
  };
}

function countPages(pdf: Buffer): number {
  const text = pdf.toString("latin1");
  const m = text.match(/\/Type\s*\/Page(?!s)/g);
  return m ? m.length : 0;
}

// 1. Marketplace baseline.
{
  const pdf = await renderPurchaseBillPdf(base());
  assert.equal(countPages(pdf), 1, "marketplace: 1 page");
}

// 2. Aggregator baseline (extra rows).
{
  const pdf = await renderPurchaseBillPdf(
    base({
      channel: "aggregator",
      soldViaAggregator: "Art Fair Hyderabad (Jubilee Hills venue)",
      intraState: true,
      amounts: {
        artistPayoutShare: 100000_00,
        tds: 100_00,
        platformFacilitation: 0,
        convenience: 2000_00,
        convenienceGst: 360_00,
        technology: 1000_00,
        technologyGst: 180_00,
        otherCharges: 0,
        otherChargesGst: 0,
        delivery: 2000_00,
        rcmGst: 0,
        netPayable: 94360_00,
      },
    }),
  );
  assert.equal(countPages(pdf), 1, "aggregator: 1 page");
}

// 3. All deductions on + large title (stress).
{
  const pdf = await renderPurchaseBillPdf(
    base({
      channel: "aggregator",
      soldViaAggregator: "A very long aggregator venue name including city, locality and a specific event name sub-descriptor",
      artwork: {
        id: "ART-STRESS-0001",
        title:
          "An exceptionally long artwork title that stretches over multiple lines and tests the description cell for wrapping across the multi-row settlement table",
        medium: "Mixed media on reclaimed canvas with gold leaf, 48\" × 72\"",
        hsn: "9701",
      },
      intraState: false, // inter-state stress case
      amounts: {
        artistPayoutShare: 500000_00,
        tds: 500_00,
        platformFacilitation: 0,
        convenience: 10000_00,
        convenienceGst: 1800_00, // 18% × 10,000
        technology: 5000_00,
        technologyGst: 900_00, // 18% × 5,000
        otherCharges: 2000_00,
        otherChargesGst: 360_00, // 18% × 2,000
        delivery: 5000_00,
        rcmGst: 0,
        netPayable: 474440_00,
      },
    }),
  );
  assert.equal(countPages(pdf), 1, "stress: 1 page");
}

// 4. Overflow guard is exported.
{
  const err = new PurchaseBillPageOverflowError(2);
  assert.equal(err.name, "PurchaseBillPageOverflowError");
  assert.match(err.message, /2 pages/);
}

console.log(
  "apps/api/purchase-bill-pdf.ts: marketplace, aggregator, stress stayed at 1 page + overflow guard exported",
);
