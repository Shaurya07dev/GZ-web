// Tax-invoice PDF renderer — audit §9. Server-side pdfkit so the backend
// never needs to run a browser; the output is a single A4 page sized for
// typical international postal/courier printers.
//
// Layout mirrors a standard Indian GST tax invoice:
//   - header: seller legal name + GSTIN + invoice number + date,
//   - billed-to: buyer name + full ship-to address + place of supply,
//   - line items: artwork title with HSN (97019020 for paintings), taxable
//     value + tax split (CGST+SGST intra-state, IGST inter-state),
//     delivery + convenience fee as separate lines,
//   - totals in words + amount payable,
//   - footer: support email + computer-generated-invoice disclaimer.

import PDFDocument from "pdfkit";
import type { InvoiceSnapshot, OrderDoc } from "@galleryzone/db";

export interface InvoiceLineInput {
  /** Order being invoiced. */
  order: OrderDoc & { id: string };
  /** Frozen snapshot — pulled from the order doc by the caller. */
  invoice: InvoiceSnapshot;
  /** Shown on the single line item. */
  artworkTitle: string;
}

const RUPEE = "₹";

export function renderInvoicePdf(input: InvoiceLineInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 48 });
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
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // --- Header ---------------------------------------------------------------
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(invoice.seller.legalName.toUpperCase(), { align: "left" });
  doc.moveDown(0.2);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#555")
    .text(
      [
        invoice.seller.addressLine1,
        invoice.seller.addressLine2,
        `${invoice.seller.city}, ${invoice.seller.state} ${invoice.seller.pincode}`,
        invoice.seller.gstin ? `GSTIN: ${invoice.seller.gstin}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      { align: "left" },
    );
  doc.fillColor("black");

  const headerY = doc.y;
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("TAX INVOICE", doc.page.margins.left, headerY - 42, {
      align: "right",
      width: pageWidth,
    });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#555")
    .text(
      `Invoice No: ${invoice.number}\nDate: ${formatDate(invoice.issuedAt.toDate())}\nOrder: ${order.id}`,
      { align: "right", width: pageWidth },
    );
  doc.fillColor("black");

  doc.moveDown(1.5);
  rule(doc);

  // --- Buyer block ----------------------------------------------------------
  doc.moveDown(0.8);
  const buyerY = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).text("Billed to", doc.page.margins.left, buyerY);
  doc
    .font("Helvetica")
    .fontSize(10)
    .text(
      [
        invoice.buyer.name,
        invoice.buyer.addressLine1,
        invoice.buyer.addressLine2,
        `${invoice.buyer.city}, ${invoice.buyer.state} ${invoice.buyer.pincode}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Place of supply", doc.page.margins.left + pageWidth / 2, buyerY);
  doc.font("Helvetica").fontSize(10).text(invoice.buyer.state);

  doc.moveDown(1);
  rule(doc);
  doc.moveDown(0.8);

  // --- Line items table -----------------------------------------------------
  const col = {
    desc: doc.page.margins.left,
    hsn: doc.page.margins.left + pageWidth * 0.55,
    qty: doc.page.margins.left + pageWidth * 0.7,
    amount: doc.page.margins.left + pageWidth * 0.82,
  };

  doc.font("Helvetica-Bold").fontSize(9);
  const headerRowY = doc.y;
  doc.text("Description", col.desc, headerRowY, { width: col.hsn - col.desc - 4 });
  doc.text("HSN/SAC", col.hsn, headerRowY, { width: col.qty - col.hsn - 4 });
  doc.text("Qty", col.qty, headerRowY, { width: col.amount - col.qty - 4 });
  doc.text(`Amount (${RUPEE})`, col.amount, headerRowY, {
    width: pageWidth - (col.amount - col.desc),
    align: "right",
  });
  doc.moveDown(0.5);
  rule(doc);
  doc.moveDown(0.4);

  doc.font("Helvetica").fontSize(10);
  const itemY = doc.y;
  doc.text(artworkTitle, col.desc, itemY, {
    width: col.hsn - col.desc - 4,
  });
  // After the multi-line description, come back up to the row baseline.
  const descBottom = doc.y;
  doc.text("97019020", col.hsn, itemY, { width: col.qty - col.hsn - 4 });
  doc.text("1", col.qty, itemY, { width: col.amount - col.qty - 4 });
  doc.text(formatPaise(order.displayPricePaise), col.amount, itemY, {
    width: pageWidth - (col.amount - col.desc),
    align: "right",
  });
  doc.y = Math.max(doc.y, descBottom);
  doc.moveDown(0.6);

  if (order.deliveryChargePaise > 0) {
    const y = doc.y;
    doc.text("Delivery charges", col.desc, y, { width: col.hsn - col.desc - 4 });
    doc.text("996812", col.hsn, y, { width: col.qty - col.hsn - 4 });
    doc.text("1", col.qty, y, { width: col.amount - col.qty - 4 });
    doc.text(formatPaise(order.deliveryChargePaise), col.amount, y, {
      width: pageWidth - (col.amount - col.desc),
      align: "right",
    });
    doc.moveDown(0.6);
  }

  if (order.convenienceFeePaise > 0) {
    const y = doc.y;
    doc.text("Convenience fee", col.desc, y, { width: col.hsn - col.desc - 4 });
    doc.text("998599", col.hsn, y, { width: col.qty - col.hsn - 4 });
    doc.text("1", col.qty, y, { width: col.amount - col.qty - 4 });
    doc.text(formatPaise(order.convenienceFeePaise), col.amount, y, {
      width: pageWidth - (col.amount - col.desc),
      align: "right",
    });
    doc.moveDown(0.6);
  }

  rule(doc);
  doc.moveDown(0.6);

  // --- Totals ---------------------------------------------------------------
  const subtotalPaise =
    order.displayPricePaise + order.deliveryChargePaise + order.convenienceFeePaise;
  summaryRow(doc, "Subtotal (taxable)", subtotalPaise, pageWidth);

  if (invoice.taxBreakdown.kind === "intra_state") {
    summaryRow(doc, "CGST", invoice.taxBreakdown.cgstPaise, pageWidth);
    summaryRow(doc, "SGST", invoice.taxBreakdown.sgstPaise, pageWidth);
  } else {
    summaryRow(doc, "IGST", invoice.taxBreakdown.igstPaise, pageWidth);
  }

  doc.moveDown(0.2);
  rule(doc);
  doc.moveDown(0.4);
  summaryRow(doc, "Total payable", order.totalPaise, pageWidth, { bold: true, large: true });

  doc.moveDown(0.5);
  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .fillColor("#444")
    .text(`In words: ${amountInWords(order.totalPaise)}`, {
      width: pageWidth,
    });
  doc.fillColor("black");

  // --- Footer ---------------------------------------------------------------
  const footerText = [
    "This is a computer-generated tax invoice; no signature is required.",
    "Reverse charge: No. Supply made under: Section 7 of the CGST Act, 2017.",
  ].join("\n");
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#777")
    .text(footerText, doc.page.margins.left, doc.page.height - 90, {
      width: pageWidth,
      align: "center",
    });
}

function rule(doc: PDFKit.PDFDocument): void {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  doc
    .strokeColor("#ddd")
    .lineWidth(0.5)
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .stroke()
    .strokeColor("black");
}

function summaryRow(
  doc: PDFKit.PDFDocument,
  label: string,
  paise: number,
  pageWidth: number,
  opts: { bold?: boolean; large?: boolean } = {},
): void {
  const left = doc.page.margins.left;
  const y = doc.y;
  doc
    .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts.large ? 12 : 10)
    .text(label, left + pageWidth * 0.55, y, {
      width: pageWidth * 0.27,
      align: "right",
    });
  doc.text(`${RUPEE} ${formatPaise(paise)}`, left + pageWidth * 0.82, y, {
    width: pageWidth * 0.18,
    align: "right",
  });
  doc.moveDown(0.3);
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

/**
 * Indian-style words for ₹: "Twelve thousand three hundred fifty and 50/100
 * Rupees only." Intentionally compact — this is a glanceable line, not a
 * primary field. Supports values up to 99 crore.
 */
function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const subPaise = paise % 100;
  const rupeeWords = numberToIndianWords(rupees);
  return `${rupeeWords} and ${String(subPaise).padStart(2, "0")}/100 Rupees only.`;
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
