// Aggregator Commission Tax Invoice — the GST invoice the AGGREGATOR
// issues to GalleryZone for their tier share of the Markup Pool on a
// facilitated sale.
//
// Legal pattern: per MOU Clause 9.6 (v2026.4) the aggregator is
// required to issue a GST tax invoice for their inclusive share. In
// practice most aggregators can't / won't generate one, so GalleryZone
// generates it on their behalf — pre-filled — and the aggregator
// accepts it in the settlement portal with an "Agree" action. The
// PDF carries a clear disclaimer line saying so, and the acceptance
// timestamp + IP is stamped on the snapshot.
//
// Numbering: GZ/AC/<FY>/NNNNNN (aggregator commission, per fiscal year).
//
// GST math: the commercial share is GST-INCLUSIVE at 18% (per MOU 9.6).
// So if the share is Rs. 10,000, the taxable value = 10,000 / 1.18 =
// Rs. 8,474.58 and the GST (CGST+SGST or IGST) = Rs. 1,525.42.
// 26.4A forbids GalleryZone from paying anything on top.

import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
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
  formatDateTime,
  stateDisplayCode,
  textAt,
} from "./doc-pdf-primitives.ts";

const LOGO_EXISTS = existsSync(LOGO_PATH);
const SIGNATURE_EXISTS = existsSync(SIGNATURE_PATH);

export interface AggregatorCommissionInvoiceSnapshot {
  /** "GZ/AC/2026-27/000142". Globally unique per fiscal year. */
  number: string;
  fiscalYear: string;
  /** When the invoice was first drawn / stamped. */
  issuedAt: Date;
  /** Due date for the aggregator — typically T+15 business days from
   *  the sale's delivery date. */
  dueDate: Date;
  /** Billing period (helps the aggregator reconcile with their books). */
  servicePeriod: { from: Date; to: Date };

  /** The "FROM" party — the aggregator (who is legally issuing this
   *  invoice). All fields frozen at stamp time; later profile edits
   *  don't change what was printed. */
  aggregator: {
    legalName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    stateCode: string;
    numericCode: string;
    phone: string | null;
    email: string | null;
    pan: string | null;
    gstin: string | null;
  };
  /** The "BILL TO" party — GalleryZone (the recipient of the supply). */
  billedTo: {
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
  /** Which artwork sale this commission relates to. */
  sale: {
    artworkId: string;
    artworkTitle: string;
    artistName: string;
    medium: string | null;
    customerInvoiceNumber: string;
    saleDate: Date;
    /** Listed selling price in paise (full price the buyer paid). */
    listedSellingPaise: number;
    /** Artist's own price in paise. */
    artistPaise: number;
  };
  /** GST-inclusive aggregator share (per MOU Clause 9.1 / 9.6). */
  commercialShare: {
    /** The tier the aggregator was on for this sale (Tier 1 / 2 / 3). */
    tier: 1 | 2 | 3;
    /** Rate applied (20 / 35 / 50). */
    tierPercent: 20 | 35 | 50;
    /** Markup pool for this sale in paise (LSP - Artist price). */
    markupPoolPaise: number;
    /** Gross commission payable to aggregator (tier% × markup pool),
     *  GST-INCLUSIVE. */
    grossInclusivePaise: number;
  };
  /** The computed GST split from the inclusive total. One of:
   *  - intra_state: cgstPaise + sgstPaise (aggregator and GZ in same state)
   *  - inter_state: igstPaise
   *  - unregistered: null (no GST — aggregator has no GSTIN) */
  taxBreakdown:
    | { kind: "intra_state"; taxablePaise: number; cgstPaise: number; sgstPaise: number; ratePercent: 18 }
    | { kind: "inter_state"; taxablePaise: number; igstPaise: number; ratePercent: 18 }
    | { kind: "unregistered"; taxablePaise: number; ratePercent: 0 };
  /** Aggregator's acceptance stamp. If null the aggregator hasn't
   *  tapped "I agree" in the settlement portal yet; PDF shows a
   *  "Pending acceptance" badge. */
  acceptance: {
    acceptedAt: Date;
    acceptedByIp: string;
    acceptedByUserAgent: string;
  } | null;
}

export class AggregatorInvoicePageOverflowError extends Error {
  constructor(pages: number) {
    super(
      `Aggregator commission invoice rendered ${pages} pages; template is one A4.`,
    );
    this.name = "AggregatorInvoicePageOverflowError";
  }
}

export function renderAggregatorCommissionInvoicePdf(
  snapshot: AggregatorCommissionInvoiceSnapshot,
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
        reject(new AggregatorInvoicePageOverflowError(range.count));
        return;
      }
      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

function draw(
  doc: PDFKit.PDFDocument,
  s: AggregatorCommissionInvoiceSnapshot,
): void {
  const pageLeft = doc.page.margins.left;
  const pageRight = doc.page.width - doc.page.margins.right;
  const pageWidth = pageRight - pageLeft;
  const pageTop = doc.page.margins.top;

  // ─── Header ─────────────────────────────────────────────────────────
  if (LOGO_EXISTS) {
    doc.image(LOGO_PATH, pageLeft, pageTop, { height: 36 });
  } else {
    textAt(doc, "GALLERYZONE", pageLeft, pageTop + 6, pageWidth * 0.5, "left", {
      font: "Helvetica-Bold",
      size: 16,
    });
  }
  textAt(doc, "TAX INVOICE", pageLeft, pageTop, pageWidth, "right", {
    font: "Helvetica-Bold",
    size: 14,
  });
  textAt(
    doc,
    "Aggregator Commission on Facilitated Sale",
    pageLeft,
    pageTop + 18,
    pageWidth,
    "right",
    { font: "Helvetica", size: 9, color: COLOR_MUTED },
  );

  let y = pageTop + 46;

  // ─── Parties ────────────────────────────────────────────────────────
  const colGap = 20;
  const colW = (pageWidth - colGap) / 2;
  const leftX = pageLeft;
  const rightX = pageLeft + colW + colGap;

  textAt(doc, "FROM (Supplier — Aggregator)", leftX, y, colW, "left", {
    font: "Helvetica-Bold",
    size: 11,
    color: COLOR_TEXT,
  });
  textAt(doc, "BILL TO (Recipient)", rightX, y, colW, "right", {
    font: "Helvetica-Bold",
    size: 11,
    color: COLOR_TEXT,
  });
  y += 16;

  const fromLines = [
    s.aggregator.legalName,
    s.aggregator.addressLine1,
    s.aggregator.addressLine2,
    `${s.aggregator.city}, ${s.aggregator.state} - ${s.aggregator.pincode}`,
    `State Code: ${s.aggregator.stateCode} (${s.aggregator.numericCode})`,
    s.aggregator.gstin ? `GSTIN: ${s.aggregator.gstin}` : "GST Status: Unregistered",
    s.aggregator.pan ? `PAN: ${s.aggregator.pan}` : null,
    s.aggregator.email ? `Email: ${s.aggregator.email}` : null,
    s.aggregator.phone ? `Phone: ${s.aggregator.phone}` : null,
  ].filter((l): l is string => Boolean(l && l.trim()));

  const toLines = [
    s.billedTo.legalName,
    s.billedTo.addressLine1,
    s.billedTo.addressLine2,
    `${s.billedTo.city}, ${s.billedTo.state} - ${s.billedTo.pincode}`,
    `State Code: ${s.billedTo.stateCode}`,
    `GSTIN: ${s.billedTo.gstin}`,
    `PAN: ${s.billedTo.pan}`,
  ].filter((l): l is string => Boolean(l && l.trim()));

  let ly = y;
  for (const line of fromLines) {
    textAt(doc, line, leftX, ly, colW, "left", { font: "Helvetica", size: 9.5 });
    ly += 12;
  }
  let ry = y;
  for (const line of toLines) {
    textAt(doc, line, rightX, ry, colW, "right", { font: "Helvetica", size: 9.5 });
    ry += 12;
  }
  y = Math.max(ly, ry) + 8;

  // ─── Metadata strip ─────────────────────────────────────────────────
  drawHline(doc, pageLeft, pageRight, y);
  y += 8;
  const metaRowsLeft: Array<[string, string]> = [
    ["Invoice No", s.number],
    ["Issue Date", formatDate(s.issuedAt)],
    ["Due Date", formatDate(s.dueDate)],
  ];
  const metaRowsRight: Array<[string, string]> = [
    ["Artwork ID", s.sale.artworkId],
    [
      "Service Period",
      `${formatDate(s.servicePeriod.from)} – ${formatDate(s.servicePeriod.to)}`,
    ],
    ["Customer Invoice Ref", s.sale.customerInvoiceNumber],
  ];
  let mly = y;
  for (const [label, value] of metaRowsLeft) {
    textAt(doc, `${label}: ${value}`, leftX, mly, colW, "left", {
      font: "Helvetica-Bold",
      size: 9.5,
    });
    mly += 13;
  }
  let mry = y;
  for (const [label, value] of metaRowsRight) {
    textAt(doc, `${label}: ${value}`, rightX, mry, colW, "right", {
      font: "Helvetica-Bold",
      size: 9.5,
    });
    mry += 13;
  }
  y = Math.max(mly, mry) + 6;

  // ─── Items table ────────────────────────────────────────────────────
  const w = { sno: 24, qty: 30, incl: 90, amt: 90 };
  const descW = pageWidth - (w.sno + w.qty + w.incl + w.amt);
  const x = {
    sno: pageLeft,
    desc: pageLeft + w.sno,
    qty: pageLeft + w.sno + descW,
    incl: pageLeft + w.sno + descW + w.qty,
    amt: pageLeft + w.sno + descW + w.qty + w.incl,
  };
  const rightEdge = x.amt + w.amt;

  const headerTop = y;
  const headerH = 22;
  drawHline(doc, pageLeft, rightEdge, headerTop);
  drawHline(doc, pageLeft, rightEdge, headerTop + headerH);
  const htY = headerTop + 7;
  const hdr = { font: "Helvetica-Bold", size: 8 };
  textAt(doc, "S.No", x.sno, htY, w.sno, "center", hdr);
  textAt(doc, "Service Description", x.desc + 2, htY, descW - 4, "left", hdr);
  textAt(doc, "QTY", x.qty, htY, w.qty, "center", hdr);
  textAt(doc, "Rate (Incl. Tax)", x.incl + 2, htY, w.incl - 4, "right", hdr);
  textAt(doc, "Amount (Rs.)", x.amt + 2, htY, w.amt - 4, "right", hdr);

  y = headerTop + headerH;

  // Single row — commission on this sale
  const serviceDesc = [
    "Facilitation of Artwork Sale",
    `Title: ${s.sale.artworkTitle}`,
    `Artist: ${s.sale.artistName}`,
    s.sale.medium ? `Medium: ${s.sale.medium}` : null,
    `Artwork ID: ${s.sale.artworkId}`,
    `Tier: ${s.commercialShare.tier} (${s.commercialShare.tierPercent}% of Markup Pool)`,
    `Markup Pool on this Sale: ${MONEY(s.commercialShare.markupPoolPaise)}`,
  ]
    .filter((l): l is string => Boolean(l))
    .join("\n");
  const descH = doc.heightOfString(serviceDesc, { width: descW - 4 });
  const rowH = Math.max(descH + 10, 32);
  const rowTop = y;
  const textY = rowTop + 5;
  const body = { font: "Helvetica", size: 9 };
  textAt(doc, "1", x.sno, textY, w.sno, "center", body);
  textAt(doc, serviceDesc, x.desc + 2, textY, descW - 4, "left", body);
  textAt(doc, "1", x.qty, textY, w.qty, "center", body);
  textAt(doc, MONEY(s.commercialShare.grossInclusivePaise), x.incl + 2, textY, w.incl - 4, "right", {
    ...body,
    wrap: false,
  });
  textAt(doc, MONEY(s.commercialShare.grossInclusivePaise), x.amt + 2, textY, w.amt - 4, "right", {
    ...body,
    wrap: false,
  });
  y = rowTop + rowH;
  drawHline(doc, pageLeft, rightEdge, y);

  doc.strokeColor(COLOR_BORDER).lineWidth(0.5);
  for (const vx of [pageLeft, x.desc, x.qty, x.incl, x.amt, rightEdge]) {
    doc.moveTo(vx, headerTop).lineTo(vx, y).stroke();
  }

  // ─── Totals block (right-aligned) ───────────────────────────────────
  const totalsLabelX = pageLeft + pageWidth * 0.55;
  const totalsValueX = pageLeft + pageWidth * 0.80;
  const totalsLabelW = totalsValueX - totalsLabelX - 8;
  const totalsValueW = rightEdge - totalsValueX;

  type TRow = { label: string; value: string; bold?: boolean; separator?: boolean };
  const tRows: TRow[] = [
    { label: "Taxable Value", value: MONEY(s.taxBreakdown.taxablePaise) },
  ];
  if (s.taxBreakdown.kind === "intra_state") {
    tRows.push({ label: `CGST (${s.taxBreakdown.ratePercent / 2}%)`, value: MONEY(s.taxBreakdown.cgstPaise) });
    tRows.push({ label: `SGST (${s.taxBreakdown.ratePercent / 2}%)`, value: MONEY(s.taxBreakdown.sgstPaise) });
  } else if (s.taxBreakdown.kind === "inter_state") {
    tRows.push({ label: `IGST (${s.taxBreakdown.ratePercent}%)`, value: MONEY(s.taxBreakdown.igstPaise) });
  } else {
    tRows.push({ label: "GST (Aggregator Unregistered)", value: "Not Applicable" });
  }
  tRows.push({
    label: "TOTAL DUE (GST-Inclusive)",
    value: MONEY(s.commercialShare.grossInclusivePaise),
    bold: true,
    separator: true,
  });

  y += 8;
  for (const row of tRows) {
    if (row.separator) {
      drawHline(doc, totalsLabelX, rightEdge, y - 2);
      y += 2;
    }
    textAt(doc, row.label, totalsLabelX, y, totalsLabelW, "right", {
      font: row.bold ? "Helvetica-Bold" : "Helvetica",
      size: row.bold ? 10 : 9.5,
      color: row.bold ? COLOR_TEXT : COLOR_MUTED,
    });
    textAt(doc, row.value, totalsValueX, y, totalsValueW, "right", {
      font: row.bold ? "Helvetica-Bold" : "Helvetica",
      size: row.bold ? 10 : 9.5,
      wrap: false,
    });
    y += row.bold ? 18 : 14;
  }
  y += 4;

  // Amount in words
  textAt(doc, "Amount in Words:", pageLeft + 4, y, pageWidth, "left", {
    font: "Helvetica-Bold",
    size: 9.5,
  });
  textAt(
    doc,
    amountInWords(s.commercialShare.grossInclusivePaise),
    pageLeft + 4,
    y + 11,
    pageWidth - 8,
    "left",
    { font: "Helvetica-Bold", size: 10 },
  );
  y += 32;

  // ─── Self-invoice disclaimer ────────────────────────────────────────
  // Legally the aggregator issues this invoice. Since most aggregators
  // can't generate one, GalleryZone generates it on their behalf and
  // the aggregator accepts it in-app. Make that transparent on the doc
  // itself so there's no later dispute about who issued it.
  const disclaimer =
    `Invoice generated by GalleryZone Private Limited on behalf of ${s.aggregator.legalName} under their authorisation per Aggregator MOU Clause 9.6 (v2026.4). ` +
    `The aggregator's commercial share is GST-INCLUSIVE at 18% per MOU Clauses 9.1, 9.2, 9.6 and 26.4A — no additional GST is payable by GalleryZone over and above the amount shown above. ` +
    `${s.acceptance
      ? `Aggregator's acceptance recorded on ${formatDateTime(s.acceptance.acceptedAt)} IST from ${s.acceptance.acceptedByIp}.`
      : "Aggregator acceptance is PENDING — this invoice becomes effective upon acceptance in the settlement portal."
    }`;
  textAt(doc, "Legal Disclaimer:", pageLeft, y, pageWidth, "left", {
    font: "Helvetica-Bold",
    size: 9,
  });
  textAt(doc, disclaimer, pageLeft, y + 12, pageWidth, "left", {
    font: "Helvetica",
    size: 8,
    color: COLOR_TEXT,
    lineHeight: 10,
  });
  y += 12 + doc.heightOfString(disclaimer, { width: pageWidth }) + 8;

  // Place of supply / reverse charge
  const posState = s.aggregator.state.toUpperCase();
  const footerLines = [
    `Place of Supply: ${posState} (${stateDisplayCode(s.aggregator.state) || "—"}) — ${s.taxBreakdown.kind === "inter_state" ? "Inter-state" : "Intra-state"} supply.`,
    "Whether tax is payable under reverse charge: No. Supply made under Section 7 of the CGST Act, 2017.",
    "Computer-generated tax invoice. Aggregator's acceptance in the GalleryZone settlement portal constitutes a valid digital signature under Section 10A of the Information Technology Act, 2000.",
  ];
  textAt(doc, footerLines.join("\n"), pageLeft, y, pageWidth, "left", {
    font: "Helvetica",
    size: 8,
    color: COLOR_MUTED,
    lineHeight: 10,
  });
  y += doc.heightOfString(footerLines.join("\n"), { width: pageWidth }) + 10;

  // ─── Signature block ────────────────────────────────────────────────
  const sigH = 68;
  drawHline(doc, pageLeft, pageRight, y);
  drawHline(doc, pageLeft, pageRight, y + sigH);
  textAt(doc, `For ${s.aggregator.legalName}:`, pageLeft, y + 6, pageWidth - 6, "right", {
    font: "Helvetica-Bold",
    size: 9.5,
  });
  if (s.acceptance) {
    // Stamped acceptance band — looks like a signature even though the
    // aggregator's name is typed.
    textAt(
      doc,
      `${s.aggregator.legalName}\n(Accepted via portal on ${formatDate(s.acceptance.acceptedAt)})`,
      pageLeft,
      y + 24,
      pageWidth - 6,
      "right",
      { font: "Helvetica-Oblique", size: 9 },
    );
  } else if (SIGNATURE_EXISTS) {
    // No acceptance yet — the "watermark" is a pending badge rather
    // than a signature image.
    textAt(doc, "[Pending Aggregator Acceptance]", pageLeft, y + 28, pageWidth - 6, "right", {
      font: "Helvetica-Bold",
      size: 10,
      color: COLOR_MUTED,
    });
  }
  textAt(doc, "Authorised Signatory (Aggregator)", pageLeft, y + sigH - 14, pageWidth - 6, "right", {
    font: "Helvetica-Bold",
    size: 9.5,
  });
}
