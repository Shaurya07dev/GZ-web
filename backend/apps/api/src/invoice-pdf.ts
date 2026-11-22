// Tax-invoice PDF renderer — audit §9. Server-side pdfkit, one A4 page
// per invoice.
//
// Layout follows the Amazon India tax-invoice reference the client sent
// on 20 Nov 2026:
//   • Top-right stack (right half of the page): Shipping Address (bold,
//     big) → Sold By (medium) → Billing Address (small).
//   • Top-left stack: order number + order date, invoice number + date,
//     under the GalleryZone logo.
//   • Items table with 10 columns: Sl, Description, Unit Price, Discount,
//     Qty, Net Amount, Tax Rate, Tax Type, Tax Amount, Total Amount. The
//     art line splits its GST into CGST + SGST (or UTGST) sub-rows for
//     intra-state, IGST for inter-state. Shipping and Payment-Gateway
//     lines show "nil" in every tax column (PG tax is already baked into
//     the Net Amount / Total Amount per the "including tax" label).
//   • TOTAL row, Amount in Words.
//   • Signature block: "For GalleryZone Private Limited" + Sai Pawan's
//     signature PNG + "Authorized Signatory" label.
//   • Reverse-charge statement + Razorpay payment-transaction footer.
//
// EVERY `doc.text(...)` in this file passes explicit `x, y` and never
// uses `{ continued: true }`. Any continued-flow leftover pushes the
// cursor into the next-page break logic and spills the invoice across
// multiple almost-empty pages (20 Nov 2026 regression). Don't add one.
//
// Font note: pdfkit's built-in Helvetica can't render the ₹ glyph, so
// every amount flows through MONEY() which prefixes "Rs." instead.

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import PDFDocument from "pdfkit";
import { textOrMissing, type InvoiceLine, type InvoiceSnapshot, type OrderDoc } from "@galleryzone/db";

const LOGO_PATH = resolve(import.meta.dirname, "..", "assets", "invoice-logo.png");
const LOGO_EXISTS = existsSync(LOGO_PATH);

const SIGNATURE_PATH = resolve(import.meta.dirname, "..", "assets", "invoice-signatory.png");
const SIGNATURE_EXISTS = existsSync(SIGNATURE_PATH);

export interface InvoiceLineInput {
  order: OrderDoc & { id: string };
  invoice: InvoiceSnapshot;
  artworkTitle: string;
}

const MONEY = (paise: number) => `Rs. ${formatPaise(paise)}`;

const PAGE_MARGIN = 36;
const COLOR_TEXT = "#111111";
const COLOR_MUTED = "#555555";
const COLOR_BORDER = "#9a9a9a";

/** Thrown when drawing produced more than one page — a hard layout
 *  regression. The invoice format is designed around a single A4 page;
 *  if a change here starts producing a second page, we want to fail
 *  loudly in CI and on the admin's screen, not ship a half-rendered
 *  invoice to a buyer. */
export class InvoicePageOverflowError extends Error {
  constructor(pageCount: number) {
    super(
      `Invoice PDF rendered ${pageCount} pages; the template is designed for exactly one A4 page. Shorten the content or widen the layout.`,
    );
    this.name = "InvoicePageOverflowError";
  }
}

export function renderInvoicePdf(input: InvoiceLineInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // bufferPages lets us inspect the page count after drawing and
      // fail fast if anything overflowed. autoFirstPage is implicit.
      const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      drawInvoice(doc, input);
      const range = doc.bufferedPageRange();
      if (range.count > 1) {
        // Don't finish the PDF — abort so a 2-page half-invoice never
        // reaches a buyer. The caller's try/catch in the controller
        // turns this into a 500 + the guard script turns it into a
        // red CI check.
        reject(new InvoicePageOverflowError(range.count));
        return;
      }
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
  const pageTop = doc.page.margins.top;

  const utgstLabel = invoice.usesUtgst ? "UTGST" : "SGST";
  const lines: InvoiceLine[] =
    invoice.lines ?? legacyLinesFromOrder(order, artworkTitle, invoice);

  // ─── Header: logo (left) + title (right) ────────────────────────────────
  if (LOGO_EXISTS) {
    doc.image(LOGO_PATH, pageLeft, pageTop, { height: 36 });
  } else {
    textAt(doc, "GALLERYZONE", pageLeft, pageTop + 6, pageWidth * 0.5, "left", {
      font: "Helvetica-Bold",
      size: 16,
    });
  }
  textAt(
    doc,
    "Tax Invoice/Bill of Supply/Cash Memo",
    pageLeft,
    pageTop,
    pageWidth,
    "right",
    { font: "Helvetica-Bold", size: 12 },
  );
  textAt(
    doc,
    "(Original for Recipient)",
    pageLeft,
    pageTop + 14,
    pageWidth,
    "right",
    { font: "Helvetica", size: 9, color: COLOR_MUTED },
  );

  const headerBottom = pageTop + 40;

  // ─── Parties strip ─────────────────────────────────────────────────────
  // Three roles on this invoice — fixed semantics, confirmed by client
  // 20 Nov 2026:
  //   • Billed by = GalleryZone Private Limited (always). GalleryZone
  //     is the party that collected the money and issues this invoice,
  //     so its name, address, GSTIN and state code go here. Its state
  //     also drives the CGST/SGST vs IGST split below.
  //   • Sold By = the artist (marketplace channel) or aggregator
  //     (aggregator channel). This is the origin of the actual art
  //     piece. Shown informationally for the buyer; it is NOT the
  //     taxable person for this invoice.
  //   • Shipping Address = the customer's delivery address. For goods,
  //     the place of supply equals this.
  //
  // Layout:
  //   LEFT  : Billed by (GZ) → Sold By (artist/aggregator)
  //   RIGHT : Shipping Address (big/bold) + state/place metadata
  //   BELOW : order + invoice metadata band
  //
  // Every text() call is at explicit (x, y). No continued flows.
  const colGap = 20;
  const colW = (pageWidth - colGap) / 2;
  const leftX = pageLeft;
  const rightX = pageLeft + colW + colGap;

  const buyerAddrLines = [
    invoice.buyer.name,
    textOrMissing(invoice.buyer.addressLine1),
    invoice.buyer.addressLine2,
    `${textOrMissing(invoice.buyer.city) ?? ""}, ${textOrMissing(invoice.buyer.state) ?? ""}, ${textOrMissing(invoice.buyer.pincode) ?? ""}`,
    "IN",
  ].filter((s): s is string => Boolean(s && String(s).trim()));

  const buyerCode =
    invoice.placeOfSupply?.numericCode ?? stateDisplayCode(invoice.buyer.state);
  const soldBy = invoice.soldBy;

  // --- LEFT: Billed by (GalleryZone) → Sold By (artist/aggregator) -------
  let ly = headerBottom + 8;
  textAt(doc, "Billed by :", leftX, ly, colW, "left", {
    font: "Helvetica-Bold",
    size: 10,
  });
  ly += 14;
  const billedByLines = [
    invoice.seller.legalName,
    invoice.seller.addressLine1,
    invoice.seller.addressLine2,
    `${invoice.seller.city}, ${invoice.seller.state} - ${invoice.seller.pincode}`,
    "IN",
  ].filter((s): s is string => Boolean(s && String(s).trim()));
  for (const line of billedByLines) {
    textAt(doc, line, leftX, ly, colW, "left", { font: "Helvetica", size: 10 });
    ly += 12;
  }
  if (invoice.seller.gstin) {
    textAt(doc, `GSTIN: ${invoice.seller.gstin}`, leftX, ly, colW, "left", {
      font: "Helvetica-Bold",
      size: 10,
    });
    ly += 13;
  }
  if (invoice.seller.stateCode) {
    textAt(doc, `State Code: ${invoice.seller.stateCode}`, leftX, ly, colW, "left", {
      font: "Helvetica-Bold",
      size: 9.5,
    });
    ly += 12;
  }
  ly += 6;

  textAt(doc, "Sold By :", leftX, ly, colW, "left", {
    font: "Helvetica-Bold",
    size: 10,
  });
  ly += 14;
  const soldByLines = soldBy
    ? [
        soldBy.legalName,
        textOrMissing(soldBy.addressLine1),
        soldBy.addressLine2,
        `${[textOrMissing(soldBy.city), textOrMissing(soldBy.state)].filter(Boolean).join(", ")}${
          soldBy.pincode?.trim() ? ` - ${soldBy.pincode}` : " - — MISSING —"
        }`,
        "IN",
      ].filter((s): s is string => Boolean(s && s.trim()))
    : ["(Seller details unavailable)"];
  for (const line of soldByLines) {
    textAt(doc, line, leftX, ly, colW, "left", { font: "Helvetica", size: 9.5 });
    ly += 11;
  }
  if (soldBy?.pan) {
    textAt(doc, `PAN No: ${soldBy.pan}`, leftX, ly, colW, "left", {
      font: "Helvetica-Bold",
      size: 9.5,
    });
    ly += 12;
  }
  if (soldBy?.gstin) {
    textAt(doc, `GST Registration No: ${soldBy.gstin}`, leftX, ly, colW, "left", {
      font: "Helvetica-Bold",
      size: 9.5,
    });
    ly += 12;
  }

  // --- RIGHT: Shipping Address (big) + buyer GSTIN ----------------------
  let ry = headerBottom + 8;
  textAt(doc, "Shipping Address :", rightX, ry, colW, "right", {
    font: "Helvetica-Bold",
    size: 10,
  });
  ry += 14;
  for (const line of buyerAddrLines) {
    textAt(doc, line, rightX, ry, colW, "right", {
      font: "Helvetica-Bold",
      size: 10.5,
    });
    ry += 13;
  }
  if (buyerCode) {
    textAt(doc, `State/UT Code: ${buyerCode}`, rightX, ry, colW, "right", {
      font: "Helvetica-Bold",
      size: 9.5,
    });
    ry += 12;
  }
  if (invoice.placeOfSupply) {
    textAt(
      doc,
      `Place of supply: ${invoice.placeOfSupply.state.toUpperCase()}`,
      rightX,
      ry,
      colW,
      "right",
      { font: "Helvetica-Bold", size: 9.5 },
    );
    ry += 12;
  }
  if (invoice.placeOfDelivery) {
    textAt(
      doc,
      `Place of delivery: ${invoice.placeOfDelivery.state.toUpperCase()}`,
      rightX,
      ry,
      colW,
      "right",
      { font: "Helvetica-Bold", size: 9.5 },
    );
    ry += 12;
  }
  // Buyer GSTIN (when they supplied one at checkout for ITC) — belongs
  // next to the shipping address since it describes the buyer.
  if (invoice.buyer.gstin) {
    textAt(doc, `GSTIN: ${invoice.buyer.gstin}`, rightX, ry, colW, "right", {
      font: "Helvetica-Bold",
      size: 9.5,
    });
    ry += 12;
  }

  // Both columns ended independently; the metadata strip starts below
  // whichever is deeper. 10pt breathing room above the metadata labels.
  let y = Math.max(ry, ly) + 10;

  // --- Metadata strip (Order on left, Invoice on right) ------------------
  const orderDate = invoice.orderDate?.toDate() ?? order.createdAt?.toDate();
  const leftMeta: Array<[string, string]> = [
    ["Order Number", invoice.orderNumber ?? order.id],
    ["Order Date", orderDate ? formatDate(orderDate) : "-"],
  ];
  const rightMeta: Array<[string, string]> = [
    ["Invoice Number", invoice.number],
    ["Invoice Details", `${invoice.fiscalYear} · ${invoice.number}`],
    ["Invoice Date", formatDate(invoice.issuedAt.toDate())],
  ];
  let metaLeftY = y;
  for (const [label, value] of leftMeta) {
    textAt(doc, `${label}: ${value}`, leftX, metaLeftY, colW, "left", {
      font: "Helvetica-Bold",
      size: 10,
    });
    metaLeftY += 14;
  }
  let metaRightY = y;
  for (const [label, value] of rightMeta) {
    textAt(doc, `${label}: ${value}`, rightX, metaRightY, colW, "right", {
      font: "Helvetica-Bold",
      size: 10,
    });
    metaRightY += 14;
  }
  y = Math.max(metaLeftY, metaRightY) + 8;

  // ─── Items table ───────────────────────────────────────────────────────
  // One row per product (today: always a single art piece). PG and
  // Shipping are not separate rows — they're their own columns on the
  // same row, so one visual "line" shows everything paid for the piece
  // (client call 20 Nov 2026 revision).
  //
  // Column widths sum to within A4 usable width (523pt). Font sizes
  // chosen so "Rs. 50,000.00" at Helvetica 8pt (~52pt wide) fits in
  // the 56pt money cells with 4pt padding.
  const w = {
    sno: 18,
    unit: 56,
    qty: 18,
    net: 56,
    rate: 22,
    type: 26,
    taxAmt: 54,
    pg: 58,
    ship: 46,
    total: 60,
  };
  const descW =
    pageWidth -
    (w.sno + w.unit + w.qty + w.net + w.rate + w.type + w.taxAmt + w.pg + w.ship + w.total);
  const x = {
    sno: pageLeft,
    desc: pageLeft + w.sno,
    unit: pageLeft + w.sno + descW,
    qty: pageLeft + w.sno + descW + w.unit,
    net: pageLeft + w.sno + descW + w.unit + w.qty,
    rate: pageLeft + w.sno + descW + w.unit + w.qty + w.net,
    type: pageLeft + w.sno + descW + w.unit + w.qty + w.net + w.rate,
    taxAmt: pageLeft + w.sno + descW + w.unit + w.qty + w.net + w.rate + w.type,
    pg:
      pageLeft + w.sno + descW + w.unit + w.qty + w.net + w.rate + w.type + w.taxAmt,
    ship:
      pageLeft +
      w.sno +
      descW +
      w.unit +
      w.qty +
      w.net +
      w.rate +
      w.type +
      w.taxAmt +
      w.pg,
    total:
      pageLeft +
      w.sno +
      descW +
      w.unit +
      w.qty +
      w.net +
      w.rate +
      w.type +
      w.taxAmt +
      w.pg +
      w.ship,
  };
  const rightEdge = x.total + w.total;

  // Header row.
  const headerTop = y;
  const headerH = 32;
  drawHline(doc, pageLeft, rightEdge, headerTop);
  drawHline(doc, pageLeft, rightEdge, headerTop + headerH);
  const htY = headerTop + 5;
  const hdrOpts = { font: "Helvetica-Bold", size: 7.5 };
  textAt(doc, "Sl.\nNo", x.sno, htY, w.sno, "center", hdrOpts);
  textAt(doc, "Description", x.desc + 2, htY, descW - 4, "left", hdrOpts);
  textAt(doc, "Unit\nPrice", x.unit + 2, htY, w.unit - 4, "right", hdrOpts);
  textAt(doc, "Qty", x.qty, htY, w.qty, "center", hdrOpts);
  textAt(doc, "Net\nAmount", x.net + 2, htY, w.net - 4, "right", hdrOpts);
  textAt(doc, "Tax\nRate", x.rate, htY, w.rate, "center", hdrOpts);
  textAt(doc, "Tax\nType", x.type, htY, w.type, "center", hdrOpts);
  textAt(doc, "Tax\nAmount", x.taxAmt + 2, htY, w.taxAmt - 4, "right", hdrOpts);
  textAt(doc, "Payment\nGateway", x.pg + 2, htY, w.pg - 4, "right", hdrOpts);
  textAt(doc, "Shipping\nCharges", x.ship + 2, htY, w.ship - 4, "right", hdrOpts);
  textAt(doc, "Total\nAmount", x.total + 2, htY, w.total - 4, "right", hdrOpts);

  y = headerTop + headerH;

  // Extract the three canonical line kinds from the frozen snapshot.
  // The data model keeps them as separate `lines[]` entries but the
  // renderer collapses them into one row with PG + Shipping as columns.
  const artLine =
    lines.find((l) => l.gstRatePercent === 5 || l.hsnOrSac.startsWith("9701")) ??
    lines[0];
  const pgLine = lines.find((l) =>
    l.description.toLowerCase().startsWith("payment gateway"),
  );
  const shipLine = lines.find((l) =>
    l.description.toLowerCase().startsWith("shipping"),
  );

  // Render a single consolidated product row. `visibleTaxPaise` drives
  // the TOTAL row's Tax Amount column — only the explicitly-shown tax,
  // not PG's absorbed GST.
  const consolidated = drawConsolidatedRow(doc, {
    idx: 1,
    y,
    x,
    w,
    descW,
    rightEdge,
    intraStateLabel: utgstLabel,
    art: artLine,
    pg: pgLine,
    ship: shipLine,
    artworkId: order.artworkId,
  });
  y = consolidated.nextY;
  const visibleTaxTotal = consolidated.visibleTaxPaise;

  // Vertical column rules spanning header + body.
  doc.strokeColor(COLOR_BORDER).lineWidth(0.5);
  for (const vx of [
    pageLeft,
    x.desc,
    x.unit,
    x.qty,
    x.net,
    x.rate,
    x.type,
    x.taxAmt,
    x.pg,
    x.ship,
    x.total,
    rightEdge,
  ]) {
    doc.moveTo(vx, headerTop).lineTo(vx, y).stroke();
  }

  // ─── TOTAL row ─────────────────────────────────────────────────────────
  const totalY = y;
  const totalH = 20;
  drawHline(doc, pageLeft, rightEdge, totalY);
  drawHline(doc, pageLeft, rightEdge, totalY + totalH);
  textAt(doc, "TOTAL:", x.sno + 4, totalY + 6, descW, "left", {
    font: "Helvetica-Bold",
    size: 10,
  });
  // wrap:false + 8pt bold — the money columns in the consolidated
  // layout are ~54-60pt effective; a bigger font or wrap-enabled flow
  // would split "Rs. 53,990.00" across two lines.
  textAt(doc, MONEY(visibleTaxTotal), x.taxAmt + 2, totalY + 6, w.taxAmt - 4, "right", {
    font: "Helvetica-Bold",
    size: 8.5,
    wrap: false,
  });
  textAt(doc, MONEY(order.totalPaise), x.total + 2, totalY + 6, w.total - 4, "right", {
    font: "Helvetica-Bold",
    size: 8.5,
    wrap: false,
  });
  y = totalY + totalH;

  // Amount in Words.
  textAt(doc, "Amount in Words:", pageLeft + 4, y + 4, pageWidth, "left", {
    font: "Helvetica-Bold",
    size: 10,
  });
  textAt(
    doc,
    amountInWords(order.totalPaise),
    pageLeft + 4,
    y + 18,
    pageWidth - 8,
    "left",
    { font: "Helvetica-Bold", size: 10 },
  );
  y += 38;

  // ─── Signature block ───────────────────────────────────────────────────
  const sigTop = y;
  const sigH = 78;
  drawHline(doc, pageLeft, rightEdge, sigTop);
  drawHline(doc, pageLeft, rightEdge, sigTop + sigH);
  textAt(
    doc,
    `For ${invoice.seller.legalName}:`,
    pageLeft,
    sigTop + 6,
    pageWidth - 6,
    "right",
    { font: "Helvetica-Bold", size: 10 },
  );
  if (SIGNATURE_EXISTS) {
    const sigImgH = 32;
    const sigImgW = 110;
    doc.image(SIGNATURE_PATH, rightEdge - sigImgW - 4, sigTop + 22, {
      fit: [sigImgW, sigImgH],
      align: "right",
    });
  }
  textAt(
    doc,
    "Authorized Signatory",
    pageLeft,
    sigTop + sigH - 14,
    pageWidth - 6,
    "right",
    { font: "Helvetica-Bold", size: 10 },
  );
  y = sigTop + sigH + 6;

  textAt(
    doc,
    "Whether tax is payable under reverse charge - No",
    pageLeft,
    y,
    pageWidth,
    "left",
    { font: "Helvetica", size: 9 },
  );
  y += 16;

  // ─── Payment transaction footer ────────────────────────────────────────
  if (invoice.payment) {
    drawPaymentBlock(doc, { invoice, order, x: pageLeft, y, width: pageWidth, rightEdge });
  }
}

// ─── Consolidated product row ──────────────────────────────────────────
//
// One visual row per product. The art line owns the row; PG and
// Shipping render as their own columns next to the art's tax columns.
// Tax breakdown:
//   - Intra-state art → two stacked sub-rows (CGST half + SGST / UTGST
//     half) in the Tax Rate / Tax Type / Tax Amount columns.
//   - Inter-state art → one IGST sub-row.
//   - PG column → PG's gross price (base + 18% service GST baked in).
//   - Shipping column → the courier pass-through.

/** Column keys the X-position map has (all cells including description). */
type XKey =
  | "sno"
  | "desc"
  | "unit"
  | "qty"
  | "net"
  | "rate"
  | "type"
  | "taxAmt"
  | "pg"
  | "ship"
  | "total";

/** Column keys the width map has (every column except description —
 *  description width is tracked in its own `descW` variable since it
 *  fills whatever space the fixed-width columns don't claim). */
type WKey = Exclude<XKey, "desc">;

interface ConsolidatedRowArgs {
  idx: number;
  y: number;
  x: Record<XKey, number>;
  w: Record<WKey, number>;
  descW: number;
  rightEdge: number;
  intraStateLabel: "SGST" | "UTGST";
  art: InvoiceLine | undefined;
  pg: InvoiceLine | undefined;
  ship: InvoiceLine | undefined;
  artworkId: string;
}

function drawConsolidatedRow(
  doc: PDFKit.PDFDocument,
  a: ConsolidatedRowArgs,
): { nextY: number; visibleTaxPaise: number } {
  const { idx, x, w, descW, rightEdge, intraStateLabel, art, pg, ship, artworkId } = a;
  const emptyLine: InvoiceLine = {
    description: "(no data)",
    hsnOrSac: "-",
    qty: 0,
    unitPricePaise: 0,
    taxablePaise: 0,
    gstRatePercent: 0,
  };
  const row = art ?? emptyLine;

  // Tax trio sub-rows for the art line.
  type SubRow = { label: string; rate: string; amount: string };
  const subRows: SubRow[] = [];
  let visibleTaxPaise = 0;
  if (row.cgstPaise != null || row.sgstPaise != null) {
    const half = row.gstRatePercent / 2;
    if (row.cgstPaise != null) {
      subRows.push({
        label: "CGST",
        rate: `${half}%`,
        amount: row.cgstPaise > 0 ? MONEY(row.cgstPaise) : "nil",
      });
      visibleTaxPaise += row.cgstPaise;
    }
    if (row.sgstPaise != null) {
      subRows.push({
        label: intraStateLabel,
        rate: `${half}%`,
        amount: row.sgstPaise > 0 ? MONEY(row.sgstPaise) : "nil",
      });
      visibleTaxPaise += row.sgstPaise;
    }
  } else if (row.igstPaise != null) {
    subRows.push({
      label: "IGST",
      rate: `${row.gstRatePercent}%`,
      amount: row.igstPaise > 0 ? MONEY(row.igstPaise) : "nil",
    });
    visibleTaxPaise += row.igstPaise;
  } else {
    subRows.push({ label: "nil", rate: "nil", amount: "nil" });
  }

  // Description cell: title + HSN + Artwork ID. Artwork ID lets ops
  // trace the piece back to the artworks collection.
  const descRich = [
    row.description,
    `HSN: ${row.hsnOrSac}`,
    `Artwork ID: ${artworkId}`,
  ].join("\n");

  const descHeight = doc.heightOfString(descRich, { width: descW - 4 });
  const subH = subRows.length * 11;
  const rowH = Math.max(descHeight + 10, subH + 10, 32);
  const rowTop = a.y;
  const textY = rowTop + 5;

  const cellOpts = { font: "Helvetica", size: 8 } as const;

  // Fixed cells (Sl / Description / Unit / Qty / Net / Total).
  textAt(doc, String(idx), x.sno, textY, w.sno, "center", cellOpts);
  textAt(doc, descRich, x.desc + 2, textY, descW - 4, "left", cellOpts);
  textAt(doc, MONEY(row.unitPricePaise), x.unit + 2, textY, w.unit - 4, "right", {
    ...cellOpts,
    wrap: false,
  });
  textAt(doc, String(row.qty || 1), x.qty, textY, w.qty, "center", cellOpts);
  textAt(doc, MONEY(row.taxablePaise), x.net + 2, textY, w.net - 4, "right", {
    ...cellOpts,
    wrap: false,
  });

  // Tax trio sub-rows for the art line, stacked.
  subRows.forEach((sr, i) => {
    const sy = textY + i * 11;
    textAt(doc, sr.rate, x.rate, sy, w.rate, "center", cellOpts);
    textAt(doc, sr.label, x.type, sy, w.type, "center", cellOpts);
    textAt(doc, sr.amount, x.taxAmt + 2, sy, w.taxAmt - 4, "right", {
      ...cellOpts,
      wrap: false,
    });
  });

  // Payment Gateway column — gross price (service GST already inside).
  // Adds the clarifier directly below the amount.
  if (pg) {
    textAt(doc, MONEY(pg.unitPricePaise), x.pg + 2, textY, w.pg - 4, "right", {
      ...cellOpts,
      wrap: false,
    });
    textAt(doc, "(incl. tax)", x.pg + 2, textY + 11, w.pg - 4, "right", {
      font: "Helvetica",
      size: 7,
      color: COLOR_MUTED,
    });
  } else {
    textAt(doc, "-", x.pg + 2, textY, w.pg - 4, "right", cellOpts);
  }

  // Shipping column — courier pass-through. Zero-tax by GalleryZone's
  // pure-agent treatment, so we just show the amount.
  if (ship) {
    textAt(doc, MONEY(ship.unitPricePaise), x.ship + 2, textY, w.ship - 4, "right", {
      ...cellOpts,
      wrap: false,
    });
  } else {
    textAt(doc, "-", x.ship + 2, textY, w.ship - 4, "right", cellOpts);
  }

  // Total column — art-with-tax + PG + Shipping.
  const artTotal =
    row.taxablePaise +
    (row.cgstPaise ?? 0) +
    (row.sgstPaise ?? 0) +
    (row.igstPaise ?? 0);
  const total = artTotal + (pg?.unitPricePaise ?? 0) + (ship?.unitPricePaise ?? 0);
  textAt(doc, MONEY(total), x.total + 2, textY, w.total - 4, "right", {
    ...cellOpts,
    wrap: false,
  });

  const nextY = rowTop + rowH;
  drawHline(doc, pageLeft(doc), rightEdge, nextY);
  return { nextY, visibleTaxPaise };
}

// ─── Payment transaction footer ────────────────────────────────────────

function drawPaymentBlock(
  doc: PDFKit.PDFDocument,
  args: {
    invoice: InvoiceSnapshot;
    order: OrderDoc & { id: string };
    x: number;
    y: number;
    width: number;
    rightEdge: number;
  },
): void {
  const { invoice, order, x, y, width, rightEdge } = args;
  const rowH = 30;
  const gap = 8;
  const c1 = width * 0.34;
  const c2 = width * 0.26;
  const c3 = width * 0.18;
  const c4 = width - c1 - c2 - c3 - gap * 3;

  drawHline(doc, x, rightEdge, y);
  drawHline(doc, x, rightEdge, y + rowH);

  textAt(doc, "Payment Transaction ID:", x + 4, y + 4, c1, "left", {
    font: "Helvetica-Bold",
    size: 9,
  });
  textAt(doc, invoice.payment?.transactionId ?? "-", x + 4, y + 16, c1, "left", {
    font: "Helvetica",
    size: 9,
  });

  const dt = invoice.payment?.paidAt?.toDate() ?? null;
  textAt(doc, "Date & Time:", x + c1 + gap, y + 4, c2, "left", {
    font: "Helvetica-Bold",
    size: 9,
  });
  textAt(doc, dt ? formatDateTime(dt) : "-", x + c1 + gap, y + 16, c2, "left", {
    font: "Helvetica",
    size: 9,
  });

  textAt(doc, "Invoice Value:", x + c1 + c2 + gap * 2, y + 4, c3, "left", {
    font: "Helvetica-Bold",
    size: 9,
  });
  textAt(doc, MONEY(order.totalPaise), x + c1 + c2 + gap * 2, y + 16, c3, "left", {
    font: "Helvetica",
    size: 9,
  });

  textAt(doc, "Mode of Payment:", x + c1 + c2 + c3 + gap * 3, y + 4, c4, "left", {
    font: "Helvetica-Bold",
    size: 9,
  });
  textAt(
    doc,
    invoice.payment?.method ?? "Razorpay",
    x + c1 + c2 + c3 + gap * 3,
    y + 16,
    c4,
    "left",
    { font: "Helvetica", size: 9 },
  );
}

// ─── Primitives + helpers ──────────────────────────────────────────────

interface TextOpts {
  font?: string;
  size?: number;
  color?: string;
  lineHeight?: number;
  /** Set false to force the text onto one line regardless of width —
   *  used for money cells where a wrap would split "Rs." from the
   *  number and confuse an accountant. Default true. */
  wrap?: boolean;
}

/** One-shot text placement. No continued flows, no implicit cursor
 *  advancement — the caller stays in control of Y, which is what keeps
 *  everything on a single page. */
function textAt(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  align: "left" | "right" | "center",
  opts: TextOpts = {},
): void {
  doc
    .font(opts.font ?? "Helvetica")
    .fontSize(opts.size ?? 10)
    .fillColor(opts.color ?? COLOR_TEXT)
    .text(text, x, y, { width, align, lineBreak: opts.wrap !== false });
}

function drawHline(doc: PDFKit.PDFDocument, x1: number, x2: number, y: number): void {
  doc.strokeColor(COLOR_BORDER).lineWidth(0.5).moveTo(x1, y).lineTo(x2, y).stroke();
}

function pageLeft(doc: PDFKit.PDFDocument): number {
  return doc.page.margins.left;
}

function legacyLinesFromOrder(
  order: OrderDoc & { id: string },
  artworkTitle: string,
  invoice: InvoiceSnapshot,
): InvoiceLine[] {
  const artworkTaxable = order.displayPricePaise - order.gstPaise;
  const out: InvoiceLine[] = [];
  const kind = invoice.taxBreakdown.kind;
  function split(gst: number) {
    if (gst <= 0) return {};
    if (kind === "intra_state") {
      const half = Math.floor(gst / 2);
      return { cgstPaise: half, sgstPaise: gst - half };
    }
    return { igstPaise: gst };
  }
  out.push({
    description: artworkTitle,
    hsnOrSac: "9701",
    qty: 1,
    unitPricePaise: artworkTaxable,
    taxablePaise: artworkTaxable,
    gstRatePercent: 5,
    ...split(order.gstPaise),
  });
  if (order.convenienceFeePaise > 0) {
    out.push({
      description: "Payment gateway charge",
      hsnOrSac: "997158",
      qty: 1,
      unitPricePaise: order.convenienceFeePaise + order.convenienceGstPaise,
      taxablePaise: order.convenienceFeePaise + order.convenienceGstPaise,
      gstRatePercent: 18,
    });
  }
  if (order.deliveryChargePaise > 0) {
    out.push({
      description: "Shipping charges",
      hsnOrSac: "996812",
      qty: 1,
      unitPricePaise: order.deliveryChargePaise,
      taxablePaise: order.deliveryChargePaise,
      gstRatePercent: 0,
    });
  }
  return out;
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
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function stateDisplayCode(state: string): string {
  const upper = state.trim().toUpperCase();
  const map: Record<string, string> = {
    "ANDHRA PRADESH": "37",
    "ARUNACHAL PRADESH": "12",
    ASSAM: "18",
    BIHAR: "10",
    CHHATTISGARH: "22",
    GOA: "30",
    GUJARAT: "24",
    HARYANA: "06",
    "HIMACHAL PRADESH": "02",
    JHARKHAND: "20",
    KARNATAKA: "29",
    KERALA: "32",
    "MADHYA PRADESH": "23",
    MAHARASHTRA: "27",
    MANIPUR: "14",
    MEGHALAYA: "17",
    MIZORAM: "15",
    NAGALAND: "13",
    ODISHA: "21",
    PUNJAB: "03",
    RAJASTHAN: "08",
    SIKKIM: "11",
    "TAMIL NADU": "33",
    TELANGANA: "36",
    TRIPURA: "16",
    "UTTAR PRADESH": "09",
    UTTARAKHAND: "05",
    "WEST BENGAL": "19",
    DELHI: "07",
    "JAMMU AND KASHMIR": "01",
    LADAKH: "38",
    PUDUCHERRY: "34",
    "ANDAMAN AND NICOBAR ISLANDS": "35",
    CHANDIGARH: "04",
    "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "26",
    LAKSHADWEEP: "31",
  };
  return map[upper] ?? "";
}

function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const subPaise = paise % 100;
  const rupeeWords = numberToIndianWords(rupees);
  if (subPaise === 0) return `${rupeeWords} Rupees only`;
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
  return rest === 0 ? `${ONES[h]} Hundred` : `${ONES[h]} Hundred ${twoDigits(rest)}`;
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
