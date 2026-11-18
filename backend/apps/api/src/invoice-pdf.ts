// Tax-invoice PDF renderer — audit §9. Server-side pdfkit so the backend
// never needs to run a browser; the output is a single A4 page sized for
// typical international postal/courier printers.
//
// Layout mirrors an Amazon India-style GST tax invoice:
//   - letterhead: black-on-white GalleryZone mark + seller legal name +
//     address + GSTIN on the left, "TAX INVOICE" + invoice number + date
//     + order id on the right.
//   - billed-to / shipped-to blocks (equal columns, independent heights).
//   - items table with proper cell borders and column headers, so an
//     accountant can scan it like a spreadsheet.
//   - totals block right-aligned, with tax split and amount payable.
//   - footer: GST declarations + computer-generated-invoice disclaimer.
//
// Font note (18 Nov 2026): pdfkit's built-in Helvetica/Times fonts are
// WinAnsi-encoded and cannot render the ₹ glyph — the renderer produces
// a superscript "¹" substitute that looked broken on a buyer's invoice.
// We now prefix every amount with "Rs." instead, which is unambiguous,
// matches how Amazon India invoices read, and avoids shipping a TTF
// in the Docker image. If the client wants the ₹ glyph later, embed a
// Unicode-capable font (Noto Sans, DejaVu Sans) via doc.registerFont()
// — the rest of the renderer already uses a central MONEY helper so a
// one-line swap makes the whole invoice switch symbols.

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import PDFDocument from "pdfkit";
import type { InvoiceSnapshot, OrderDoc } from "@galleryzone/db";

/** Black-on-white GalleryZone logo (gz-logo-mark.png — the C-in-black + Z-in-gold
 *  version, visible on a white invoice background). Missing-file fallback is the
 *  text-only all-caps treatment. */
const LOGO_PATH = resolve(import.meta.dirname, "..", "assets", "invoice-logo.png");
const LOGO_EXISTS = existsSync(LOGO_PATH);

export interface InvoiceLineInput {
  /** Order being invoiced. */
  order: OrderDoc & { id: string };
  /** Frozen snapshot — pulled from the order doc by the caller. */
  invoice: InvoiceSnapshot;
  /** Shown on the single line item. */
  artworkTitle: string;
}

/** The currency marker every amount on this invoice uses. See font note above
 *  for why we don't print the ₹ glyph directly from the built-in pdfkit fonts. */
const MONEY = (paise: number) => `Rs. ${formatPaise(paise)}`;

// --- Layout constants (A4 page, 48pt margins) ------------------------------
const PAGE_MARGIN = 40;
const COLOR_TEXT = "#111111";
const COLOR_MUTED = "#555555";
const COLOR_FAINT = "#888888";
const COLOR_BORDER = "#cccccc";
const COLOR_SHADED = "#f5f5f5";

export function renderInvoicePdf(input: InvoiceLineInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      drawInvoice(doc, input);
      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

function drawInvoice(doc: PDFKit.PDFDocument, input: InvoiceLineInput): void {
  const { invoice, order, artworkTitle } = input;
  const pageLeft = doc.page.margins.left;
  const pageRight = doc.page.width - doc.page.margins.right;
  const pageWidth = pageRight - pageLeft;
  const colGap = 14;

  // ─── Header: letterhead on the left, invoice meta on the right ──────────
  const HEADER_TOP = doc.page.margins.top;
  const letterheadLeft = pageLeft;
  const letterheadWidth = pageWidth * 0.55;
  const metaLeft = pageLeft + letterheadWidth + colGap;
  const metaWidth = pageWidth - letterheadWidth - colGap;

  // Logo (top-left, fixed size, no inline text wrap) + company block below it.
  let letterheadY = HEADER_TOP;
  if (LOGO_EXISTS) {
    doc.image(LOGO_PATH, letterheadLeft, letterheadY, { height: 46 });
    letterheadY += 54;
  }
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(COLOR_TEXT)
    .text(invoice.seller.legalName.toUpperCase(), letterheadLeft, letterheadY, {
      width: letterheadWidth,
    });
  letterheadY = doc.y + 2;
  const sellerLines = [
    invoice.seller.addressLine1,
    invoice.seller.addressLine2,
    `${invoice.seller.city}, ${invoice.seller.state} - ${invoice.seller.pincode}`,
    invoice.seller.gstin ? `GSTIN: ${invoice.seller.gstin}` : null,
    invoice.seller.stateCode ? `State Code: ${invoice.seller.stateCode}` : null,
  ].filter(Boolean) as string[];
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLOR_MUTED)
    .text(sellerLines.join("\n"), letterheadLeft, letterheadY, {
      width: letterheadWidth,
      lineGap: 2,
    });
  const letterheadBottom = doc.y;

  // Right-column meta: title + invoice number + date + order id.
  let metaY = HEADER_TOP;
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor(COLOR_TEXT)
    .text("TAX INVOICE", metaLeft, metaY, { width: metaWidth, align: "right" });
  metaY = doc.y + 8;
  const metaRows: Array<[string, string]> = [
    ["Invoice No", invoice.number],
    ["Date", formatDate(invoice.issuedAt.toDate())],
    ["Order ID", order.id],
    ["Fiscal Year", invoice.fiscalYear],
  ];
  for (const [label, value] of metaRows) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLOR_MUTED)
      .text(`${label}:`, metaLeft, metaY, {
        width: metaWidth * 0.45,
        align: "right",
        continued: false,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(COLOR_TEXT)
      .text(value, metaLeft + metaWidth * 0.5, metaY, {
        width: metaWidth * 0.5,
        align: "right",
      });
    metaY = doc.y + 3;
  }
  const metaBottom = metaY;

  // Advance below whichever column ended lower.
  let y = Math.max(letterheadBottom, metaBottom) + 16;
  hr(doc, y);
  y += 12;

  // ─── Billed-to / Shipped-to columns ─────────────────────────────────────
  const partyColWidth = (pageWidth - colGap) / 2;
  const billedLeft = pageLeft;
  const shippedLeft = pageLeft + partyColWidth + colGap;

  const billedLines = [
    invoice.buyer.name,
    invoice.buyer.addressLine1,
    invoice.buyer.addressLine2,
    `${invoice.buyer.city}, ${invoice.buyer.state} - ${invoice.buyer.pincode}`,
  ].filter(Boolean) as string[];
  const shippedHeading = "Place of supply";
  const shippedBody = `${invoice.buyer.state} (${stateDisplayCode(invoice.buyer.state)})`;

  const billedBottom = drawPartyBlock(doc, {
    x: billedLeft,
    y,
    width: partyColWidth,
    heading: "Billed to",
    lines: billedLines,
  });
  const shippedBottom = drawPartyBlock(doc, {
    x: shippedLeft,
    y,
    width: partyColWidth,
    heading: shippedHeading,
    lines: [shippedBody],
  });

  y = Math.max(billedBottom, shippedBottom) + 16;
  hr(doc, y);
  y += 16;

  // ─── Items table ────────────────────────────────────────────────────────
  // Columns (sum to pageWidth):
  //   # | Description | HSN/SAC | Qty | Unit Price | Amount
  const colWidths = {
    sno: 28,
    hsn: 58,
    qty: 32,
    unit: 86,
    amount: 86,
  };
  colWidths.hsn;
  const descWidth =
    pageWidth - colWidths.sno - colWidths.hsn - colWidths.qty - colWidths.unit - colWidths.amount;

  type ItemRow = { description: string; hsn: string; qty: number; unitPaise: number; amountPaise: number };
  const items: ItemRow[] = [
    {
      description: artworkTitle,
      hsn: "97019020", // paintings
      qty: 1,
      unitPaise: order.displayPricePaise,
      amountPaise: order.displayPricePaise,
    },
  ];
  if (order.deliveryChargePaise > 0) {
    items.push({
      description: "Delivery charges",
      hsn: "996812",
      qty: 1,
      unitPaise: order.deliveryChargePaise,
      amountPaise: order.deliveryChargePaise,
    });
  }
  if (order.convenienceFeePaise > 0) {
    // Labelled "Payment gateway charge" (not "Convenience fee") per client
    // direction 16 Nov 2026 — this line is the Razorpay processing fee
    // passed through to the buyer, not an internal convenience markup. The
    // wording matters on a tax invoice.
    items.push({
      description: "Payment gateway charge",
      hsn: "998599",
      qty: 1,
      unitPaise: order.convenienceFeePaise,
      amountPaise: order.convenienceFeePaise,
    });
  }

  const colX = {
    sno: pageLeft,
    desc: pageLeft + colWidths.sno,
    hsn: pageLeft + colWidths.sno + descWidth,
    qty: pageLeft + colWidths.sno + descWidth + colWidths.hsn,
    unit: pageLeft + colWidths.sno + descWidth + colWidths.hsn + colWidths.qty,
    amount: pageLeft + colWidths.sno + descWidth + colWidths.hsn + colWidths.qty + colWidths.unit,
  };
  const rightEdge = colX.amount + colWidths.amount;

  // Header row with shaded background.
  const headerRowY = y;
  const headerHeight = 22;
  doc.save();
  doc.rect(pageLeft, headerRowY, pageWidth, headerHeight).fill(COLOR_SHADED);
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_TEXT);
  const headerTextY = headerRowY + 7;
  doc.text("#", colX.sno + 4, headerTextY, { width: colWidths.sno - 8, align: "center" });
  doc.text("Description", colX.desc + 4, headerTextY, { width: descWidth - 8 });
  doc.text("HSN/SAC", colX.hsn + 4, headerTextY, { width: colWidths.hsn - 8, align: "center" });
  doc.text("Qty", colX.qty + 4, headerTextY, { width: colWidths.qty - 8, align: "center" });
  doc.text("Unit price", colX.unit + 4, headerTextY, { width: colWidths.unit - 8, align: "right" });
  doc.text("Amount", colX.amount + 4, headerTextY, { width: colWidths.amount - 8, align: "right" });
  // Header top + bottom border.
  doc
    .strokeColor(COLOR_BORDER)
    .lineWidth(0.5)
    .moveTo(pageLeft, headerRowY)
    .lineTo(rightEdge, headerRowY)
    .stroke()
    .moveTo(pageLeft, headerRowY + headerHeight)
    .lineTo(rightEdge, headerRowY + headerHeight)
    .stroke();
  y = headerRowY + headerHeight;

  // Data rows. Pre-measure row height from the (possibly multi-line) description
  // so numbers stay vertically aligned and the row borders enclose the full cell.
  doc.font("Helvetica").fontSize(10).fillColor(COLOR_TEXT);
  items.forEach((row, index) => {
    const descHeight = doc.heightOfString(row.description, { width: descWidth - 8 });
    const rowHeight = Math.max(descHeight + 12, 24);
    const rowTop = y;
    const textY = rowTop + 6;
    doc.text(String(index + 1), colX.sno + 4, textY, { width: colWidths.sno - 8, align: "center" });
    doc.text(row.description, colX.desc + 4, textY, { width: descWidth - 8 });
    doc.text(row.hsn, colX.hsn + 4, textY, { width: colWidths.hsn - 8, align: "center" });
    doc.text(String(row.qty), colX.qty + 4, textY, { width: colWidths.qty - 8, align: "center" });
    doc.text(MONEY(row.unitPaise), colX.unit + 4, textY, {
      width: colWidths.unit - 8,
      align: "right",
    });
    doc.text(MONEY(row.amountPaise), colX.amount + 4, textY, {
      width: colWidths.amount - 8,
      align: "right",
    });
    y = rowTop + rowHeight;
    doc
      .strokeColor(COLOR_BORDER)
      .lineWidth(0.5)
      .moveTo(pageLeft, y)
      .lineTo(rightEdge, y)
      .stroke();
  });

  // Vertical column separators across the full table.
  const tableTop = headerRowY;
  const tableBottom = y;
  const dividers = [colX.desc, colX.hsn, colX.qty, colX.unit, colX.amount, rightEdge];
  doc.strokeColor(COLOR_BORDER).lineWidth(0.5);
  for (const x of [pageLeft, ...dividers]) {
    doc.moveTo(x, tableTop).lineTo(x, tableBottom).stroke();
  }

  y += 18;

  // ─── Totals block (right-aligned) ───────────────────────────────────────
  const subtotalPaise =
    order.displayPricePaise + order.deliveryChargePaise + order.convenienceFeePaise;
  const totalsLeft = pageLeft + pageWidth * 0.55;
  const totalsLabelX = totalsLeft;
  const totalsValueX = pageLeft + pageWidth * 0.78;
  const totalsLabelWidth = totalsValueX - totalsLabelX - 8;
  const totalsValueWidth = rightEdge - totalsValueX;

  const totalsRows: Array<{ label: string; value: string; bold?: boolean; separator?: boolean }> = [
    { label: "Subtotal (taxable)", value: MONEY(subtotalPaise) },
  ];
  if (invoice.taxBreakdown.kind === "intra_state") {
    totalsRows.push({ label: "CGST", value: MONEY(invoice.taxBreakdown.cgstPaise) });
    totalsRows.push({ label: "SGST", value: MONEY(invoice.taxBreakdown.sgstPaise) });
  } else {
    totalsRows.push({ label: "IGST", value: MONEY(invoice.taxBreakdown.igstPaise) });
  }
  totalsRows.push({ label: "Total payable", value: MONEY(order.totalPaise), bold: true, separator: true });

  for (const row of totalsRows) {
    if (row.separator) {
      doc
        .strokeColor(COLOR_BORDER)
        .lineWidth(0.75)
        .moveTo(totalsLabelX, y - 2)
        .lineTo(rightEdge, y - 2)
        .stroke();
      y += 4;
    }
    doc
      .font(row.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(row.bold ? 11 : 10)
      .fillColor(row.bold ? COLOR_TEXT : COLOR_MUTED)
      .text(row.label, totalsLabelX, y, { width: totalsLabelWidth, align: "right" });
    doc
      .font(row.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(row.bold ? 11 : 10)
      .fillColor(COLOR_TEXT)
      .text(row.value, totalsValueX, y, { width: totalsValueWidth, align: "right" });
    y += row.bold ? 18 : 14;
  }

  // Amount in words.
  y += 6;
  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .fillColor(COLOR_MUTED)
    .text(`Amount in words: ${amountInWords(order.totalPaise)}`, pageLeft, y, {
      width: pageWidth,
    });

  // ─── Footer ─────────────────────────────────────────────────────────────
  const footerLines = [
    "This is a computer-generated tax invoice; no signature is required.",
    "Reverse charge: No. Supply made under Section 7 of the CGST Act, 2017.",
    "For queries, contact support@galleryzone.in.",
  ];
  const footerY = doc.page.height - doc.page.margins.bottom - 48;
  doc
    .strokeColor(COLOR_BORDER)
    .lineWidth(0.5)
    .moveTo(pageLeft, footerY - 8)
    .lineTo(rightEdge, footerY - 8)
    .stroke();
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLOR_FAINT)
    .text(footerLines.join("\n"), pageLeft, footerY, {
      width: pageWidth,
      align: "center",
      lineGap: 2,
    });
}

// ─── Primitives ──────────────────────────────────────────────────────────

function hr(doc: PDFKit.PDFDocument, y: number): void {
  doc
    .strokeColor(COLOR_BORDER)
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke();
}

function drawPartyBlock(
  doc: PDFKit.PDFDocument,
  opts: { x: number; y: number; width: number; heading: string; lines: string[] },
): number {
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLOR_FAINT)
    .text(opts.heading.toUpperCase(), opts.x, opts.y, { width: opts.width, characterSpacing: 0.4 });
  const headingBottom = doc.y + 3;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLOR_TEXT)
    .text(opts.lines.join("\n"), opts.x, headingBottom, { width: opts.width, lineGap: 2 });
  return doc.y;
}

function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Two-letter state code for a given full state name — falls back to "" if
 *  the state isn't in the lookup. Used to show "Maharashtra (MH)" in the
 *  Place-of-supply block. */
function stateDisplayCode(state: string): string {
  const upper = state.trim().toUpperCase();
  const map: Record<string, string> = {
    "ANDHRA PRADESH": "AP",
    "ARUNACHAL PRADESH": "AR",
    ASSAM: "AS",
    BIHAR: "BR",
    CHHATTISGARH: "CG",
    GOA: "GA",
    GUJARAT: "GJ",
    HARYANA: "HR",
    "HIMACHAL PRADESH": "HP",
    JHARKHAND: "JH",
    KARNATAKA: "KA",
    KERALA: "KL",
    "MADHYA PRADESH": "MP",
    MAHARASHTRA: "MH",
    MANIPUR: "MN",
    MEGHALAYA: "ML",
    MIZORAM: "MZ",
    NAGALAND: "NL",
    ODISHA: "OD",
    PUNJAB: "PB",
    RAJASTHAN: "RJ",
    SIKKIM: "SK",
    "TAMIL NADU": "TN",
    TELANGANA: "TS",
    TRIPURA: "TR",
    "UTTAR PRADESH": "UP",
    UTTARAKHAND: "UK",
    "WEST BENGAL": "WB",
    DELHI: "DL",
    "JAMMU AND KASHMIR": "JK",
    LADAKH: "LA",
    PUDUCHERRY: "PY",
    "ANDAMAN AND NICOBAR ISLANDS": "AN",
    CHANDIGARH: "CH",
    "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "DN",
    LAKSHADWEEP: "LD",
  };
  return map[upper] ?? "";
}

/**
 * Indian-style words for ₹: "Twelve thousand three hundred fifty and 50/100
 * Rupees only." Intentionally compact — this is a glanceable line, not a
 * primary field. Supports values up to 99 crore.
 */
function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const subPaise = paise % 100;
  const rupeeWords = numberToIndianWords(rupees);
  return `${rupeeWords} Rupees and ${String(subPaise).padStart(2, "0")}/100 only`;
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o === 0 ? (TENS[t] ?? "") : `${TENS[t]} ${ONES[o]}`;
}

function threeDigits(n: number): string {
  if (n < 100) return twoDigits(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return rest === 0
    ? `${ONES[h]} Hundred`
    : `${ONES[h]} Hundred ${twoDigits(rest)}`;
}

function numberToIndianWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1_000);
  const rest = n % 1_000;
  if (crore > 0) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest > 0) parts.push(threeDigits(rest));
  return parts.join(" ").trim();
}
