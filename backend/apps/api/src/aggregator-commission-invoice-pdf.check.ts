// Aggregator-commission-invoice format-stability guard.
//
// Run from `backend/`:
//   node --experimental-strip-types apps/api/src/aggregator-commission-invoice-pdf.check.ts

import assert from "node:assert/strict";
import {
  AggregatorInvoicePageOverflowError,
  renderAggregatorCommissionInvoicePdf,
  type AggregatorCommissionInvoiceSnapshot,
} from "./aggregator-commission-invoice-pdf.ts";

function base(
  overrides: Partial<AggregatorCommissionInvoiceSnapshot> = {},
): AggregatorCommissionInvoiceSnapshot {
  const grossInclusive = 6000_00;
  const taxable = Math.round((grossInclusive * 100) / 118);
  const gst = grossInclusive - taxable;
  const cgst = Math.floor(gst / 2);
  const sgst = gst - cgst;
  return {
    number: "GZ/AC/2026-27/000001",
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
    acceptance: {
      acceptedAt: new Date("2026-11-21T11:04:12.000Z"),
      acceptedByIp: "49.207.221.86",
      acceptedByUserAgent: "Mozilla/5.0",
    },
    ...overrides,
  };
}

function countPages(pdf: Buffer): number {
  const text = pdf.toString("latin1");
  const m = text.match(/\/Type\s*\/Page(?!s)/g);
  return m ? m.length : 0;
}

// 1. Intra-state, Tier 1, accepted.
{
  const pdf = await renderAggregatorCommissionInvoicePdf(base());
  assert.equal(countPages(pdf), 1, "intra-state Tier 1: 1 page");
}

// 2. Inter-state (aggregator in Karnataka), Tier 2.
{
  const grossInclusive = 10500_00;
  const taxable = Math.round((grossInclusive * 100) / 118);
  const gst = grossInclusive - taxable;
  const pdf = await renderAggregatorCommissionInvoicePdf(
    base({
      aggregator: {
        legalName: "Blue Lotus Gallery",
        addressLine1: "22/A, Lavelle Road",
        addressLine2: null,
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
        stateCode: "KA",
        numericCode: "29",
        phone: "+91 99000 11223",
        email: "accounts@bluelotus.in",
        pan: "BLUEB1234Q",
        gstin: "29BLUEB1234Q1Z1",
      },
      commercialShare: {
        tier: 2,
        tierPercent: 35,
        markupPoolPaise: 30000_00,
        grossInclusivePaise: grossInclusive,
      },
      taxBreakdown: {
        kind: "inter_state",
        taxablePaise: taxable,
        igstPaise: gst,
        ratePercent: 18,
      },
    }),
  );
  assert.equal(countPages(pdf), 1, "inter-state Tier 2: 1 page");
}

// 3. Unregistered aggregator — no GST line.
{
  const pdf = await renderAggregatorCommissionInvoicePdf(
    base({
      aggregator: {
        ...base().aggregator,
        gstin: null,
        pan: null,
      },
      taxBreakdown: {
        kind: "unregistered",
        taxablePaise: 6000_00,
        ratePercent: 0,
      },
    }),
  );
  assert.equal(countPages(pdf), 1, "unregistered: 1 page");
}

// 4. Pending acceptance variant.
{
  const pdf = await renderAggregatorCommissionInvoicePdf(
    base({ acceptance: null }),
  );
  assert.equal(countPages(pdf), 1, "pending acceptance: 1 page");
}

// 5. Overflow guard exported.
{
  const err = new AggregatorInvoicePageOverflowError(3);
  assert.equal(err.name, "AggregatorInvoicePageOverflowError");
  assert.match(err.message, /3 pages/);
}

console.log(
  "apps/api/aggregator-commission-invoice-pdf.ts: intra, inter, unregistered, pending stayed at 1 page + overflow guard exported",
);
