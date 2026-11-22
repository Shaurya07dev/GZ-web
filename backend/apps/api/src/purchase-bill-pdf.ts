// Purchase-cum-Payment Bill — the document GalleryZone issues to the
// ARTIST when GZ pays them for a sold piece. CGST Rule 52 requires a
// registered recipient (GZ) to issue a payment voucher to an
// unregistered supplier (artist) summarising the deductions + GST-RCM
// treatment of the payout.
//
// Two channels, one renderer (channel flag toggles the deduction rows):
//   - Marketplace:    Line 2 = "Platform / Gallery Facilitation" only
//   - Aggregator:     Line 2 = adds Convenience + Technology charges
//
// Numbering: GZ/PV/<FY>/NNNNNN (payment voucher sequence, per fiscal
// year). Stamped on the OrderDoc on settlement release.
//
// Layout matches the tax-invoice look-and-feel so a buyer, admin and
// artist all recognise them as from the same company.

import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import { textOrMissing } from "@galleryzone/db";
import {
  COLOR_BORDER,
  COLOR_MUTED,
  COLOR_TEXT,
  LOGO_PATH,
  MONEY,
  PAGE_MARGIN,
  SIGNATURE_PATH,
  amountInWords,
  drawHline,
  formatDate,
  stateDisplayCode,
  textAt,
} from "./doc-pdf-primitives.ts";

const LOGO_EXISTS = existsSync(LOGO_PATH);
const SIGNATURE_EXISTS = existsSync(SIGNATURE_PATH);

/** Minimum snapshot the renderer needs. Mirrors what the stamp logic
 *  will freeze onto the order doc. */
export interface PurchaseBillSnapshot {
  /** "GZ/PV/2026-27/000142". Globally unique per fiscal year. */
  number: string;
  fiscalYear: string;
  channel: "marketplace" | "aggregator";
  /** When GZ actually released the payment (also stamped). */
  voucherDate: Date;
  /** Bank UTR / Razorpay payout id — the settlement reference. */
  paymentRef: string;
  /** Payment method stamped at release. */
  paymentMode: "NEFT" | "RTGS" | "UPI" | "Cheque" | "Wallet";
  /** Order the bill is paying out for. */
  orderNumber: string;
  /** The buyer tax invoice this payout corresponds to (for audit). */
  customerInvoiceNumber: string | null;
  /** GalleryZone identity (the registered payer). */
  payer: {
    legalName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    gstin: string;
    stateCode: string;
    pan: string;
  };
  /** The artist (unregistered payee, or registered — GST status marked
   *  separately). All fields frozen at stamp time. */
  payee: {
    fullName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    pan: string | null;
    phone: string | null;
    /** "Unregistered" if no GSTIN on file; else the GSTIN. Printed
     *  verbatim on the bill in the row heading. */
    gstStatus: string;
  };
  artwork: {
    id: string;
    title: string;
    medium: string | null;
    hsn: string; // "9701"
  };
  /** Aggregator leg — only populated when channel === "aggregator". */
  soldViaAggregator?: string | null;
  /** Supply classification for the service-fee rows (convenience,
   *  technology, other charges). Determined by comparing payer
   *  (GalleryZone) state vs payee (artist) state:
   *    - true  → CGST 9% + SGST 9% split on each service row
   *    - false → IGST 18% single-cell on each service row
   *  Required even on the marketplace channel for consistency; the
   *  marketplace channel just has zero service fees so no row prints. */
  intraState: boolean;

  /** All amounts in paise. Mirrors `ArtistSettlement` from
   *  packages/domain/src/pricing.ts so the invoice can never drift
   *  from what the settlement ledger actually wrote. */
  amounts: {
    /** Line 1. Artist's gross payout before any deduction (= artist price). */
    artistPayoutShare: number;
    /** TDS under §194-O. 0.1% × artist price when above the ₹5L threshold. */
    tds: number;
    /** Marketplace-channel: platform/gallery facilitation fee. 0 on
     *  aggregator channel. */
    platformFacilitation: number;
    /** Aggregator-channel only. 2% × artist price. SAC 998599. */
    convenience: number;
    /** 18% × convenience. Shown inline next to the convenience row. */
    convenienceGst: number;
    /** Aggregator-channel only. 1% × artist price. SAC 998319. */
    technology: number;
    /** 18% × technology. Shown inline next to the technology row. */
    technologyGst: number;
    /** Aggregator-channel only. Real-cost pass-through, usually 0. */
    otherCharges: number;
    /** 18% × otherCharges. Shown inline next to the otherCharges row. */
    otherChargesGst: number;
    /** Aggregator-channel only. The artist→aggregator leg (zero-tax
     *  pass-through — client call 20 Nov 2026). */
    delivery: number;
    /** RCM GST on the artwork — 0 for HSN 9701 (exempt from RCM for
     *  unregistered suppliers). Only printed when > 0. */
    rcmGst: number;
    /** Final amount paid to the artist = gross − every line above. */
    netPayable: number;
  };
}

export class PurchaseBillPageOverflowError extends Error {
  constructor(pages: number) {
    super(`Purchase bill rendered ${pages} pages; template is designed for one A4.`);
    this.name = "PurchaseBillPageOverflowError";
  }
}

export function renderPurchaseBillPdf(
  snapshot: PurchaseBillSnapshot,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: PAGE_MARGIN,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      draw(doc, snapshot);
      const range = doc.bufferedPageRange();
      if (range.count > 1) {
        reject(new PurchaseBillPageOverflowError(range.count));
        return;
      }
      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

function draw(doc: PDFKit.PDFDocument, s: PurchaseBillSnapshot): void {
  const pageLeft = doc.page.margins.left;
  const pageRight = doc.page.width - doc.page.margins.right;
  const pageWidth = pageRight - pageLeft;
  const pageTop = doc.page.margins.top;

  // ─── Header ──────────────────────────────────────────────────────────
  if (LOGO_EXISTS) {
    doc.image(LOGO_PATH, pageLeft, pageTop, { height: 36 });
  } else {
    textAt(doc, "GALLERYZONE", pageLeft, pageTop + 6, pageWidth * 0.5, "left", {
      font: "Helvetica-Bold",
      size: 16,
    });
  }
  const channelLabel =
    s.channel === "marketplace" ? "Marketplace channel" : "Aggregator channel";
  textAt(
    doc,
    `Purchase cum Payment Bill (${channelLabel})`,
    pageLeft,
    pageTop,
    pageWidth,
    "right",
    { font: "Helvetica-Bold", size: 12 },
  );
  textAt(
    doc,
    "Issued under Rule 52 of CGST Rules, 2017 — Record of Payout to Artist upon Artwork Sale",
    pageLeft,
    pageTop + 14,
    pageWidth,
    "right",
    { font: "Helvetica", size: 8, color: COLOR_MUTED },
  );

  let y = pageTop + 42;

  // ─── Meta strip ─────────────────────────────────────────────────────
  // Label bold, value regular. Two columns, three rows. Right-column
  // rows right-aligned so the value sits at the page edge.
  const metaRows: Array<[string, string]> = [
    ["Payment Voucher No", s.number],
    ["Voucher Date", formatDate(s.voucherDate)],
    ["Artwork Master ID", s.artwork.id],
    ["Customer Tax Invoice", s.customerInvoiceNumber ?? "—"],
    ["Payment Mode", s.paymentMode],
    ["Bank UTR / Ref No", s.paymentRef || "—"],
  ];
  const col1W = pageWidth / 2;
  const col2W = pageWidth / 2;
  const col2X = pageLeft + col1W;
  metaRows.forEach((row, idx) => {
    const col = idx % 2 === 0 ? 0 : 1;
    const rowY = y + Math.floor(idx / 2) * 14;
    const baseX = col === 0 ? pageLeft : col2X;
    const widthAvailable = (col === 0 ? col1W : col2W) - 6;
    // Measure both label and value at their real fonts. We pin a tiny
    // 2pt buffer around each cell so pdfkit's line-break engine never
    // wraps on a width-equal-to-measured edge case.
    const labelText = `${row[0]}:`;
    doc.font("Helvetica-Bold").fontSize(9.5);
    const labelW = doc.widthOfString(labelText);
    doc.font("Helvetica").fontSize(9.5);
    const valueW = doc.widthOfString(row[1]);
    const common = {
      font: "Helvetica-Bold" as const,
      size: 9.5,
      wrap: false,
    };
    if (col === 0) {
      // Left column: label at page-left, value flush to its right.
      textAt(doc, labelText, baseX, rowY, labelW + 2, "left", common);
      textAt(
        doc,
        row[1],
        baseX + labelW + 4,
        rowY,
        widthAvailable - labelW - 4,
        "left",
        { font: "Helvetica", size: 9.5, wrap: false },
      );
    } else {
      // Right column: value right-aligned at page edge, label sits
      // immediately to its left. wrap:false stops pdfkit's engine
      // from line-breaking a fit-width cell.
      const rightEdge = baseX + widthAvailable;
      textAt(doc, row[1], rightEdge - valueW, rowY, valueW + 2, "left", {
        font: "Helvetica",
        size: 9.5,
        wrap: false,
      });
      textAt(
        doc,
        labelText,
        rightEdge - valueW - labelW - 4,
        rowY,
        labelW + 2,
        "left",
        common,
      );
    }
  });
  y += Math.ceil(metaRows.length / 2) * 14 + 8;

  drawHline(doc, pageLeft, pageRight, y);
  y += 6;

  // ─── Parties strip ─────────────────────────────────────────────────
  // Left: Issued By (GalleryZone, registered payer)
  // Right: Paid To (artist, unregistered or registered payee)
  const colGap = 20;
  const colW = (pageWidth - colGap) / 2;
  const leftX = pageLeft;
  const rightX = pageLeft + colW + colGap;

  textAt(doc, "ISSUED BY (REGISTERED RECIPIENT / PAYER)", leftX, y, colW, "left", {
    font: "Helvetica-Bold",
    size: 10,
    color: COLOR_TEXT,
  });
  textAt(doc, "PAID TO (ARTIST / PAYEE)", rightX, y, colW, "right", {
    font: "Helvetica-Bold",
    size: 10,
    color: COLOR_TEXT,
  });
  let ly = y + 15;
  let ry = y + 15;

  const payerLines = [
    s.payer.legalName,
    textOrMissing(s.payer.addressLine1),
    s.payer.addressLine2,
    `${textOrMissing(s.payer.city) ?? ""}, ${textOrMissing(s.payer.state) ?? ""} - ${textOrMissing(s.payer.pincode) ?? ""}`,
    `GSTIN: ${s.payer.gstin}`,
    `State Code: ${s.payer.stateCode}`,
    `PAN: ${s.payer.pan}`,
  ].filter((l): l is string => Boolean(l && l.trim()));
  for (const line of payerLines) {
    textAt(doc, line, leftX, ly, colW, "left", { font: "Helvetica", size: 9.5 });
    ly += 12;
  }

  const payeeLines = [
    s.payee.fullName,
    textOrMissing(s.payee.addressLine1),
    s.payee.addressLine2,
    `${textOrMissing(s.payee.city) ?? ""}, ${textOrMissing(s.payee.state) ?? ""} - ${textOrMissing(s.payee.pincode) ?? ""}`,
    `GST Status: ${s.payee.gstStatus}`,
    s.payee.pan ? `PAN: ${s.payee.pan}` : null,
    s.payee.phone ? `Phone: ${s.payee.phone}` : null,
  ].filter((l): l is string => Boolean(l && l.trim()));
  for (const line of payeeLines) {
    textAt(doc, line, rightX, ry, colW, "right", { font: "Helvetica", size: 9.5 });
    ry += 12;
  }

  y = Math.max(ly, ry) + 8;

  drawHline(doc, pageLeft, pageRight, y);
  y += 8;

  // ─── Settlement particulars table ────────────────────────────────────
  // Columns: S.No | Description | HSN | RCM/GST Rate | Amount
  // GST column is wider than it looks — "(CGST 9% + SGST 9%)" at 8.5pt
  // is ~96pt wide, so we size the column to 104pt and shrink its font
  // to keep the parenthetical on a single line.
  const w = { sno: 22, hsn: 50, rcm: 104, amt: 86 };
  const descW = pageWidth - (w.sno + w.hsn + w.rcm + w.amt);
  const x = {
    sno: pageLeft,
    desc: pageLeft + w.sno,
    hsn: pageLeft + w.sno + descW,
    rcm: pageLeft + w.sno + descW + w.hsn,
    amt: pageLeft + w.sno + descW + w.hsn + w.rcm,
  };
  const rightEdge = x.amt + w.amt;

  const headerTop = y;
  const headerH = 22;
  drawHline(doc, pageLeft, rightEdge, headerTop);
  drawHline(doc, pageLeft, rightEdge, headerTop + headerH);
  const hdr = { font: "Helvetica-Bold", size: 8 };
  textAt(doc, "S.No", x.sno, headerTop + 7, w.sno, "center", hdr);
  textAt(doc, "Description of Artwork & Settlement Particulars", x.desc + 2, headerTop + 7, descW - 4, "left", hdr);
  textAt(doc, "HSN / SAC", x.hsn, headerTop + 7, w.hsn, "center", hdr);
  textAt(doc, "GST Rate / Type", x.rcm, headerTop + 7, w.rcm, "center", hdr);
  textAt(doc, "Amount (Rs.)", x.amt + 2, headerTop + 7, w.amt - 4, "right", hdr);

  y = headerTop + headerH;

  type Row = {
    label: string;
    desc?: string;
    hsn?: string;
    rcm?: string;
    amt: number;
    /** true → negative (deduction, shown in brackets) */
    deduct?: boolean;
  };
  const rows: Row[] = [
    {
      label: "Artist Payout Share for Sale of Original Artwork",
      desc: [
        `Title: ${s.artwork.title}`,
        s.artwork.medium ? `Medium: ${s.artwork.medium}` : null,
        s.soldViaAggregator ? `Sold via Aggregator: ${s.soldViaAggregator}` : null,
        `Order: ${s.orderNumber}`,
      ]
        .filter((v): v is string => Boolean(v))
        .join("\n"),
      hsn: s.artwork.hsn,
      rcm: "Nil / Exempt\n(Non-RCM)",
      amt: s.amounts.artistPayoutShare,
    },
  ];
  if (s.amounts.tds > 0) {
    rows.push({
      label: "Less: TDS Deducted under Income Tax (Section 194-O, 0.1%)",
      amt: s.amounts.tds,
      deduct: true,
    });
  }
  if (s.channel === "marketplace" && s.amounts.platformFacilitation > 0) {
    rows.push({
      label: "Less: Platform / Gallery Facilitation Deduction",
      amt: s.amounts.platformFacilitation,
      deduct: true,
    });
  }
  if (s.channel === "aggregator") {
    // Service-fee GST classification (per Place-of-Supply rule for
    // services from GZ to the artist). Intra-state → half-split,
    // inter-state → single IGST label. Keep the parenthetical compact
    // so it fits inside the GST column at the body font.
    const gstLabel = s.intraState
      ? "18%\nCGST 9% + SGST 9%"
      : "18%\nIGST";

    if (s.amounts.convenience > 0) {
      rows.push({
        label:
          "Less: Convenience Charges (2% × Artist Price, inclusive of 18% service GST)",
        hsn: "998599", // SAC 9985 — Other professional services
        rcm: gstLabel,
        amt: s.amounts.convenience + s.amounts.convenienceGst,
        deduct: true,
      });
    }
    if (s.amounts.technology > 0) {
      rows.push({
        label:
          "Less: Technology Charges (1% × Artist Price — NFC tag, Certificate of Authenticity, listing infrastructure, inclusive of 18% service GST)",
        hsn: "998319", // SAC 9983 — Other IT services
        rcm: gstLabel,
        amt: s.amounts.technology + s.amounts.technologyGst,
        deduct: true,
      });
    }
    if (s.amounts.otherCharges > 0) {
      rows.push({
        label:
          "Less: Other Charges (real-cost pass-through, inclusive of 18% service GST)",
        rcm: gstLabel,
        amt: s.amounts.otherCharges + s.amounts.otherChargesGst,
        deduct: true,
      });
    }
    if (s.amounts.delivery > 0) {
      rows.push({
        label: "Less: Delivery Charge (Artist → Aggregator leg, zero-tax pass-through)",
        rcm: "Nil",
        amt: s.amounts.delivery,
        deduct: true,
      });
    }
    if (s.amounts.platformFacilitation > 0) {
      rows.push({
        label: "Less: Platform / Gallery Facilitation Deduction",
        amt: s.amounts.platformFacilitation,
        deduct: true,
      });
    }
  }
  // RCM row is only emitted when a real RCM amount applies. The common
  // case (HSN 9701 art — exempt from RCM for unregistered suppliers) is
  // mentioned in the compliance footer instead of as a zero-value row
  // that adds visual noise. 21 Nov 2026 client call.
  if (s.amounts.rcmGst > 0) {
    rows.push({
      label: "GST Under Reverse Charge Mechanism (CGST / SGST / IGST)",
      rcm: "RCM",
      amt: s.amounts.rcmGst,
    });
  }

  const body = { font: "Helvetica", size: 9 };
  const gstBody = { font: "Helvetica", size: 8.5 };
  rows.forEach((row, idx) => {
    const descText = row.desc ? `${row.label}\n${row.desc}` : row.label;
    const descHeight = doc.heightOfString(descText, { width: descW - 4 });
    // Row must be tall enough for BOTH the description and the GST
    // cell — the GST text is multi-line for taxable rows ("18% / CGST
    // 9% + SGST 9%") and can be the tallest cell on rows with a short
    // description. Previously we only measured the description and the
    // GST cell overflowed past the row border (21 Nov 2026 regression).
    const rcmText = row.rcm ?? "";
    doc.font(gstBody.font).fontSize(gstBody.size);
    const rcmHeight = rcmText
      ? doc.heightOfString(rcmText, { width: w.rcm - 4 })
      : 0;
    const rowH = Math.max(descHeight + 10, rcmHeight + 10, 22);
    const rowTop = y;
    const textY = rowTop + 5;
    textAt(doc, String(idx + 1), x.sno, textY, w.sno, "center", body);
    textAt(doc, descText, x.desc + 2, textY, descW - 4, "left", body);
    textAt(doc, row.hsn ?? "—", x.hsn, textY, w.hsn, "center", body);
    textAt(doc, row.rcm ?? "—", x.rcm, textY, w.rcm, "center", gstBody);
    const amtLabel =
      row.amt === 0
        ? "—"
        : row.deduct
          ? `(${MONEY(row.amt)})`
          : MONEY(row.amt);
    textAt(doc, amtLabel, x.amt + 2, textY, w.amt - 4, "right", {
      ...body,
      wrap: false,
    });
    y = rowTop + rowH;
    drawHline(doc, pageLeft, rightEdge, y);
  });

  // Column rules
  doc.strokeColor(COLOR_BORDER).lineWidth(0.5);
  for (const vx of [pageLeft, x.desc, x.hsn, x.rcm, x.amt, rightEdge]) {
    doc.moveTo(vx, headerTop).lineTo(vx, y).stroke();
  }

  // ─── Net Payable row ─────────────────────────────────────────────────
  const netH = 22;
  drawHline(doc, pageLeft, rightEdge, y);
  drawHline(doc, pageLeft, rightEdge, y + netH);
  textAt(doc, "NET AMOUNT PAID TO ARTIST", x.sno + 4, y + 6, descW + w.hsn + w.rcm, "left", {
    font: "Helvetica-Bold",
    size: 10,
  });
  textAt(doc, MONEY(s.amounts.netPayable), x.amt + 2, y + 6, w.amt - 4, "right", {
    font: "Helvetica-Bold",
    size: 10,
    wrap: false,
  });
  y += netH;

  // ─── Amount in words ─────────────────────────────────────────────────
  textAt(doc, "Amount in Words:", pageLeft + 4, y + 6, pageWidth, "left", {
    font: "Helvetica-Bold",
    size: 9.5,
  });
  textAt(doc, amountInWords(s.amounts.netPayable), pageLeft + 4, y + 20, pageWidth - 8, "left", {
    font: "Helvetica-Bold",
    size: 10,
  });
  y += 40;

  // ─── Signature block ─────────────────────────────────────────────────
  const sigTop = y;
  const sigH = 80;
  drawHline(doc, pageLeft, pageRight, sigTop);
  drawHline(doc, pageLeft, pageRight, sigTop + sigH);
  textAt(doc, `For ${s.payer.legalName}:`, pageLeft, sigTop + 6, pageWidth - 6, "right", {
    font: "Helvetica-Bold",
    size: 10,
  });
  if (SIGNATURE_EXISTS) {
    doc.image(SIGNATURE_PATH, pageRight - 114, sigTop + 22, {
      fit: [110, 32],
      align: "right",
    });
  }
  textAt(doc, "Authorized Signatory", pageLeft, sigTop + sigH - 14, pageWidth - 6, "right", {
    font: "Helvetica-Bold",
    size: 10,
  });
  y = sigTop + sigH + 8;

  // ─── Compliance footer ───────────────────────────────────────────────
  const footerLines = [
    "This payment voucher is issued under Rule 52 of the CGST Rules, 2017 — recording a payout to the supplier (artist) against goods sold on the GalleryZone platform.",
    `Place of Supply: ${s.payee.state} (${stateDisplayCode(s.payee.state) || "—"}).`,
    // RCM note: the common case (HSN 9701 art, unregistered artist) is
    // exempt from reverse charge, so there's nothing to show as a row
    // in the table above. Documented here instead per 21 Nov 2026 call.
    s.amounts.rcmGst > 0
      ? "GST under Reverse Charge Mechanism applies to this payout and is shown as a settlement line above."
      : "GST under Reverse Charge Mechanism — Not applicable. HSN 9701 (original artwork) is exempt from RCM for unregistered suppliers.",
    s.payee.gstStatus === "Unregistered"
      ? "The artist is unregistered under GST. No GST invoice is issued by the artist to GalleryZone for this supply."
      : "The artist is GST-registered. The artist shall issue a separate tax invoice to GalleryZone for the above supply.",
    "Computer-generated document. No signature is required by law under Rule 52.",
  ];
  textAt(doc, footerLines.join("\n"), pageLeft, y, pageWidth, "left", {
    font: "Helvetica",
    size: 8,
    color: COLOR_MUTED,
    lineHeight: 10,
  });
}
