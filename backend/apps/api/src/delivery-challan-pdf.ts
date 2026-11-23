// Delivery Challan — CGST Rule 55 document for every leg where goods
// move without a sale (artist → aggregator for display, aggregator →
// aggregator rotation, aggregator → artist return, customer return).
// Challan accompanies the parcel in triplicate.
//
// Layout (client call 20 Nov 2026):
//   • Logo top-left, "DELIVERY CHALLAN" in BLACK top-right.
//   • Consignor (GalleryZone) in BOLD directly under the logo —
//     this is the party legally issuing the challan.
//   • Fragile icon on the top-right so a parcel handler notices before
//     reading anything else.
//   • Challan metadata + EWB data in a two-column band.
//   • Dispatched-From and Consignee in separate boxed columns with
//     BOLD titles and proper gaps between lines (no cramming).
//   • Items table — HSN/SAC header.
//   • Declaration block.
//   • THREE signature zones: GalleryZone (Authorised Signatory),
//     Artist (Consignor's Agent) and Aggregator (Consignee).

import { existsSync } from "node:fs";
import { resolve } from "node:path";
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

/** Fragile glass icon — shown top-right and next to the declaration. */
const FRAGILE_PATH = resolve(
  import.meta.dirname,
  "..",
  "assets",
  "challan-fragile.png",
);
const FRAGILE_EXISTS = existsSync(FRAGILE_PATH);

export type ChallanReason =
  | "sale_on_approval"
  | "exhibition_display"
  | "return_of_goods"
  | "job_work";

const REASON_LABEL: Record<ChallanReason, string> = {
  sale_on_approval: "Goods Sent on Approval",
  exhibition_display: "Goods Sent for Exhibition / Display",
  return_of_goods: "Return of Goods (Unsold / End of Display)",
  job_work: "Goods Sent for Job Work",
};

export type TransportMode = "Road" | "Rail" | "Air" | "Ship" | "Courier";

export interface DeliveryChallanParty {
  legalName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  stateCode: string | null;
  gstin: string | null;
}

export interface DeliveryChallanItem {
  artworkId: string;
  title: string;
  artistName: string;
  medium: string | null;
  hsn: string;
  qty: number;
  unit: string;
  artistValuePaise: number;
  provisionalValuePaise: number;
}

export interface DeliveryChallanSnapshot {
  number: string;
  fiscalYear: string;
  challanDate: Date;
  copyLabel: "Original" | "Duplicate" | "Triplicate";
  reason: ChallanReason;
  returnDeadline: Date | null;
  currentDeadline: Date | null;
  ewayBill: {
    number: string | null;
    generatedAt: Date | null;
    validUntil: Date | null;
  };
  transport: {
    mode: TransportMode;
    transporterName: string;
    vehicleOrDocket: string;
  };
  /** Consignor / Billed From — the party legally issuing the challan
   *  (always GalleryZone). Shown prominently at the top. */
  consignor: DeliveryChallanParty;
  /** Physical pickup — artist's studio on the artist→aggregator leg. */
  dispatchedFrom: DeliveryChallanParty;
  /** Delivered-to — aggregator venue, artist studio (returns), etc. */
  consignee: DeliveryChallanParty;
  items: DeliveryChallanItem[];
  notes?: string | null;
}

export class DeliveryChallanPageOverflowError extends Error {
  constructor(pages: number) {
    super(`Delivery challan rendered ${pages} pages; template is one A4.`);
    this.name = "DeliveryChallanPageOverflowError";
  }
}

export function renderDeliveryChallanPdf(
  snapshot: DeliveryChallanSnapshot,
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
        reject(new DeliveryChallanPageOverflowError(range.count));
        return;
      }
      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

function draw(doc: PDFKit.PDFDocument, s: DeliveryChallanSnapshot): void {
  const pageLeft = doc.page.margins.left;
  const pageRight = doc.page.width - doc.page.margins.right;
  const pageWidth = pageRight - pageLeft;
  const pageTop = doc.page.margins.top;

  // ─── Header (logo + heading in BLACK) ────────────────────────────────
  if (LOGO_EXISTS) {
    doc.image(LOGO_PATH, pageLeft, pageTop, { height: 40 });
  } else {
    textAt(doc, "GALLERYZONE", pageLeft, pageTop + 6, pageWidth * 0.5, "left", {
      font: "Helvetica-Bold",
      size: 16,
    });
  }
  // Fragile icon top-right — reserved width so the heading sits beside it.
  const fragileSize = 42;
  if (FRAGILE_EXISTS) {
    doc.image(FRAGILE_PATH, pageRight - fragileSize, pageTop, {
      fit: [fragileSize, fragileSize],
    });
  }
  const headingRightLimit = FRAGILE_EXISTS ? pageRight - fragileSize - 10 : pageRight;
  const headingW = headingRightLimit - pageLeft;
  textAt(doc, "DELIVERY CHALLAN", pageLeft, pageTop, headingW, "right", {
    font: "Helvetica-Bold",
    size: 16,
    color: COLOR_TEXT,
  });
  textAt(
    doc,
    `${s.copyLabel} for ${
      s.copyLabel === "Original"
        ? "Consignee"
        : s.copyLabel === "Duplicate"
          ? "Transporter"
          : "Consignor"
    }`,
    pageLeft,
    pageTop + 20,
    headingW,
    "right",
    { font: "Helvetica", size: 9, color: COLOR_MUTED },
  );
  textAt(
    doc,
    "Issued under Rule 55 of the CGST Rules, 2017",
    pageLeft,
    pageTop + 32,
    headingW,
    "right",
    { font: "Helvetica", size: 8, color: COLOR_MUTED },
  );

  let y = pageTop + 52;

  // ─── Consignor (GalleryZone) PROMINENT under logo ────────────────────
  textAt(doc, "CONSIGNOR / BILLED FROM", pageLeft, y, pageWidth, "left", {
    font: "Helvetica-Bold",
    size: 9,
    color: COLOR_MUTED,
  });
  y += 12;

  const consignorHeader = s.consignor.legalName;
  textAt(doc, consignorHeader, pageLeft, y, pageWidth, "left", {
    font: "Helvetica-Bold",
    size: 12,
    color: COLOR_TEXT,
  });
  y += 16;

  const consignorBody = [
    textOrMissing(s.consignor.addressLine1),
    s.consignor.addressLine2,
    `${textOrMissing(s.consignor.city) ?? ""}, ${textOrMissing(s.consignor.state) ?? ""} - ${textOrMissing(s.consignor.pincode) ?? ""}`,
    `GSTIN: ${s.consignor.gstin ?? "Unregistered"}   |   State Code: ${s.consignor.stateCode ?? "—"} (${stateDisplayCode(s.consignor.state) || "—"})`,
  ].filter((l): l is string => Boolean(l && l.trim()));
  for (const line of consignorBody) {
    textAt(doc, line, pageLeft, y, pageWidth, "left", {
      font: "Helvetica",
      size: 10,
    });
    y += 13;
  }
  y += 6;
  drawHline(doc, pageLeft, pageRight, y);
  y += 10;

  // ─── Challan Details + E-Way Bill (two columns) ──────────────────────
  const colGap = 18;
  const colW = (pageWidth - colGap) / 2;
  const leftX = pageLeft;
  const rightX = pageLeft + colW + colGap;

  textAt(doc, "Challan Details", leftX, y, colW, "left", {
    font: "Helvetica-Bold",
    size: 11,
    color: COLOR_TEXT,
  });
  textAt(doc, "Transport & E-Way Bill", rightX, y, colW, "left", {
    font: "Helvetica-Bold",
    size: 11,
    color: COLOR_TEXT,
  });
  y += 16;

  const left: Array<[string, string]> = [
    ["Challan No.", s.number],
    ["Challan Date", formatDate(s.challanDate)],
    ["Reason for Movement", REASON_LABEL[s.reason]],
  ];
  if (s.returnDeadline) {
    left.push(["6-Month Return Deadline", formatDate(s.returnDeadline)]);
  }
  if (s.currentDeadline) {
    left.push(["Current Placement Deadline", formatDate(s.currentDeadline)]);
  }
  const right: Array<[string, string]> = [
    [
      "E-Way Bill No.",
      s.ewayBill.number
        ? s.ewayBill.number
        : "NA (Consignment ≤ ₹50,000 or not yet generated)",
    ],
    // Only show the generated-at + valid-until rows when a bill
    // actually exists — "NA" for both reads as noise otherwise.
    ...(s.ewayBill.number && s.ewayBill.generatedAt
      ? ([["E-Way Bill Generated", formatDate(s.ewayBill.generatedAt)]] as Array<[string, string]>)
      : []),
    ...(s.ewayBill.number && s.ewayBill.validUntil
      ? ([["E-Way Bill Valid Until", formatDate(s.ewayBill.validUntil)]] as Array<[string, string]>)
      : []),
    ["Mode of Transport", s.transport.mode],
    ["Transporter / Courier", s.transport.transporterName],
    ["Vehicle / AWB No.", s.transport.vehicleOrDocket],
  ];

  let ly = y;
  for (const [label, value] of left) {
    // Bold label in black, body in regular — aligned on the same line.
    textAt(doc, label, leftX, ly, colW, "left", {
      font: "Helvetica-Bold",
      size: 9.5,
    });
    textAt(doc, value, leftX + 115, ly, colW - 115, "left", {
      font: "Helvetica",
      size: 9.5,
    });
    const h = doc.heightOfString(value, { width: colW - 115 });
    ly += Math.max(h, 12) + 3;
  }

  let ry = y;
  for (const [label, value] of right) {
    textAt(doc, label, rightX, ry, colW, "left", {
      font: "Helvetica-Bold",
      size: 9.5,
    });
    textAt(doc, value, rightX + 115, ry, colW - 115, "left", {
      font: "Helvetica",
      size: 9.5,
    });
    const h = doc.heightOfString(value, { width: colW - 115 });
    ry += Math.max(h, 12) + 3;
  }

  y = Math.max(ly, ry) + 8;
  drawHline(doc, pageLeft, pageRight, y);
  y += 12;

  // ─── Dispatched From / Consignee ─────────────────────────────────────
  // Boxed columns with clear vertical breathing room between title
  // (bold, bigger) and body (regular). Minimum 6pt gap between each
  // line in the body — per client "there should be gaps".
  textAt(doc, "Dispatched From", leftX, y, colW, "left", {
    font: "Helvetica-Bold",
    size: 11,
    color: COLOR_TEXT,
  });
  textAt(doc, "Consignee / Delivered To", rightX, y, colW, "left", {
    font: "Helvetica-Bold",
    size: 11,
    color: COLOR_TEXT,
  });
  y += 4;
  textAt(doc, "(Physical origin — pickup location)", leftX, y + 12, colW, "left", {
    font: "Helvetica-Oblique",
    size: 8,
    color: COLOR_MUTED,
  });
  textAt(doc, "(Delivery address — aggregator / artist studio)", rightX, y + 12, colW, "left", {
    font: "Helvetica-Oblique",
    size: 8,
    color: COLOR_MUTED,
  });
  y += 28;

  const fromLines = partyLines(s.dispatchedFrom);
  const toLines = partyLines(s.consignee);
  const LINE_GAP = 14;
  let fy = y;
  for (const line of fromLines) {
    textAt(doc, line, leftX, fy, colW, "left", { font: "Helvetica", size: 9.5 });
    fy += LINE_GAP;
  }
  let ty = y;
  for (const line of toLines) {
    textAt(doc, line, rightX, ty, colW, "left", { font: "Helvetica", size: 9.5 });
    ty += LINE_GAP;
  }
  y = Math.max(fy, ty) + 8;

  drawHline(doc, pageLeft, pageRight, y);
  y += 10;

  // ─── Items table ─────────────────────────────────────────────────────
  const w = {
    sno: 22,
    hsn: 50,
    qty: 24,
    unit: 30,
    artVal: 72,
    provVal: 80,
    gst: 50,
  };
  const descW = pageWidth - (w.sno + w.hsn + w.qty + w.unit + w.artVal + w.provVal + w.gst);
  const x = {
    sno: pageLeft,
    desc: pageLeft + w.sno,
    hsn: pageLeft + w.sno + descW,
    qty: pageLeft + w.sno + descW + w.hsn,
    unit: pageLeft + w.sno + descW + w.hsn + w.qty,
    artVal: pageLeft + w.sno + descW + w.hsn + w.qty + w.unit,
    provVal: pageLeft + w.sno + descW + w.hsn + w.qty + w.unit + w.artVal,
    gst: pageLeft + w.sno + descW + w.hsn + w.qty + w.unit + w.artVal + w.provVal,
  };
  const rightEdge = x.gst + w.gst;

  const headerTop = y;
  const headerH = 28;
  drawHline(doc, pageLeft, rightEdge, headerTop);
  drawHline(doc, pageLeft, rightEdge, headerTop + headerH);
  const htY = headerTop + 5;
  const hdr = { font: "Helvetica-Bold", size: 7.5 };
  textAt(doc, "S.No", x.sno, htY, w.sno, "center", hdr);
  textAt(doc, "Artwork Description, Medium & ID", x.desc + 2, htY, descW - 4, "left", hdr);
  textAt(doc, "HSN / SAC", x.hsn, htY, w.hsn, "center", hdr);
  textAt(doc, "Qty", x.qty, htY, w.qty, "center", hdr);
  textAt(doc, "Unit", x.unit, htY, w.unit, "center", hdr);
  textAt(doc, "Artist\nValue (Rs.)", x.artVal + 2, htY, w.artVal - 4, "right", hdr);
  textAt(doc, "Provisional\nValue (Rs.)", x.provVal + 2, htY, w.provVal - 4, "right", hdr);
  textAt(doc, "GST", x.gst, htY, w.gst, "center", hdr);

  y = headerTop + headerH;

  let totalProvPaise = 0;

  for (let i = 0; i < s.items.length; i++) {
    const item = s.items[i]!;
    totalProvPaise += item.provisionalValuePaise;
    const descRich = [
      item.title,
      `Artist: ${item.artistName}`,
      item.medium ? `Medium: ${item.medium}` : null,
      `Artwork ID: ${item.artworkId}`,
    ]
      .filter((l): l is string => Boolean(l))
      .join("\n");
    const descH = doc.heightOfString(descRich, { width: descW - 4 });
    const rowH = Math.max(descH + 10, 32);
    const rowTop = y;
    const textY = rowTop + 5;
    const body = { font: "Helvetica", size: 9 };
    textAt(doc, String(i + 1), x.sno, textY, w.sno, "center", body);
    textAt(doc, descRich, x.desc + 2, textY, descW - 4, "left", body);
    textAt(doc, item.hsn, x.hsn, textY, w.hsn, "center", body);
    textAt(doc, String(item.qty), x.qty, textY, w.qty, "center", body);
    textAt(doc, item.unit, x.unit, textY, w.unit, "center", body);
    textAt(doc, MONEY(item.artistValuePaise), x.artVal + 2, textY, w.artVal - 4, "right", {
      ...body,
      wrap: false,
    });
    textAt(doc, MONEY(item.provisionalValuePaise), x.provVal + 2, textY, w.provVal - 4, "right", {
      ...body,
      wrap: false,
    });
    textAt(doc, "Nil", x.gst, textY, w.gst, "center", body);
    y = rowTop + rowH;
    drawHline(doc, pageLeft, rightEdge, y);
  }

  doc.strokeColor(COLOR_BORDER).lineWidth(0.5);
  for (const vx of [pageLeft, x.desc, x.hsn, x.qty, x.unit, x.artVal, x.provVal, x.gst, rightEdge]) {
    doc.moveTo(vx, headerTop).lineTo(vx, y).stroke();
  }

  // Totals row
  const totH = 22;
  drawHline(doc, pageLeft, rightEdge, y);
  drawHline(doc, pageLeft, rightEdge, y + totH);
  textAt(
    doc,
    "TOTAL (Provisional Value for Consignment & EWB)",
    x.sno + 4,
    y + 6,
    descW + w.hsn + w.qty + w.unit + w.artVal,
    "left",
    { font: "Helvetica-Bold", size: 10 },
  );
  textAt(doc, MONEY(totalProvPaise), x.provVal + 2, y + 6, w.provVal - 4, "right", {
    font: "Helvetica-Bold",
    size: 10,
    wrap: false,
  });
  textAt(doc, "Nil", x.gst, y + 6, w.gst, "center", {
    font: "Helvetica-Bold",
    size: 10,
  });
  y += totH + 4;

  textAt(doc, "Amount in Words (Provisional Value):", pageLeft + 4, y, pageWidth, "left", {
    font: "Helvetica-Bold",
    size: 9,
  });
  textAt(doc, amountInWords(totalProvPaise), pageLeft + 4, y + 11, pageWidth - 8, "left", {
    font: "Helvetica-Bold",
    size: 10,
  });
  y += 28;

  // ─── Declaration (black heading, shorter body) ───────────────────────
  textAt(doc, "Declaration & Terms of Movement", pageLeft, y, pageWidth, "left", {
    font: "Helvetica-Bold",
    size: 10,
    color: COLOR_TEXT,
  });
  y += 13;
  const declLines = [
    "• Goods are moved strictly for exhibition / display / on-approval purposes under CGST Section 31(7) + Rule 55 — NOT a taxable supply at dispatch.",
    "• Ownership remains with the Artist until a tax invoice is raised on sale to an end customer.",
    "• If unsold within six (6) months of challan date, a tax invoice shall be raised OR goods returned under a Return Delivery Challan.",
    "• Consignee shall keep goods in the same condition as received, with the original packaging and insurance in force.",
    s.notes ? `• Notes: ${s.notes}` : "",
  ].filter((l) => Boolean(l));
  textAt(doc, declLines.join("\n"), pageLeft, y, pageWidth, "left", {
    font: "Helvetica",
    size: 8,
    color: COLOR_TEXT,
    lineHeight: 10,
  });
  y += doc.heightOfString(declLines.join("\n"), { width: pageWidth }) + 10;

  // ─── Signatures (3 zones: GZ / Artist / Aggregator) ─────────────────
  const sigH = 72;
  const sigW = (pageWidth - 16) / 3;
  const sigGap = 8;
  drawHline(doc, pageLeft, pageRight, y);
  drawHline(doc, pageLeft, pageRight, y + sigH);
  // Vertical dividers between zones
  const sigX1 = pageLeft + sigW + sigGap;
  const sigX2 = pageLeft + 2 * sigW + 2 * sigGap;
  doc.strokeColor(COLOR_BORDER).lineWidth(0.5);
  doc.moveTo(sigX1 - sigGap / 2, y).lineTo(sigX1 - sigGap / 2, y + sigH).stroke();
  doc.moveTo(sigX2 - sigGap / 2, y).lineTo(sigX2 - sigGap / 2, y + sigH).stroke();

  // Zone 1: GalleryZone Authorised Signatory (Sai Pawan sig embedded)
  textAt(doc, `For ${s.consignor.legalName}`, pageLeft, y + 6, sigW, "center", {
    font: "Helvetica-Bold",
    size: 9,
  });
  if (SIGNATURE_EXISTS) {
    doc.image(SIGNATURE_PATH, pageLeft + sigW / 2 - 40, y + 22, {
      fit: [80, 28],
    });
  }
  textAt(doc, "Authorised Signatory", pageLeft, y + sigH - 14, sigW, "center", {
    font: "Helvetica-Bold",
    size: 9,
  });

  // Zone 2: Artist signature (manual — leave blank for pen-and-ink)
  textAt(doc, `Artist: ${s.dispatchedFrom.legalName}`, sigX1, y + 6, sigW, "center", {
    font: "Helvetica-Bold",
    size: 9,
  });
  textAt(doc, "Date: _________________", sigX1, y + sigH - 28, sigW, "center", {
    font: "Helvetica",
    size: 8,
    color: COLOR_MUTED,
  });
  textAt(doc, "Artist's Signature", sigX1, y + sigH - 14, sigW, "center", {
    font: "Helvetica-Bold",
    size: 9,
  });

  // Zone 3: Aggregator / Consignee signature
  textAt(doc, `Consignee: ${s.consignee.legalName}`, sigX2, y + 6, sigW, "center", {
    font: "Helvetica-Bold",
    size: 9,
  });
  textAt(doc, "Date: _________________", sigX2, y + sigH - 28, sigW, "center", {
    font: "Helvetica",
    size: 8,
    color: COLOR_MUTED,
  });
  textAt(doc, "Consignee's Signature", sigX2, y + sigH - 14, sigW, "center", {
    font: "Helvetica-Bold",
    size: 9,
  });
}

function partyLines(p: DeliveryChallanParty): string[] {
  // Required fields pass through textOrMissing so a legacy snapshot
  // persisted with blanks prints a visible marker rather than
  // shipping a defective challan.
  return [
    p.legalName,
    textOrMissing(p.addressLine1),
    p.addressLine2,
    `${textOrMissing(p.city) ?? ""}, ${textOrMissing(p.state) ?? ""} - ${textOrMissing(p.pincode) ?? ""}`,
    p.stateCode
      ? `State Code: ${p.stateCode} (${stateDisplayCode(p.state) || "—"})`
      : null,
    `GSTIN: ${p.gstin ?? "Unregistered"}`,
  ].filter((l): l is string => Boolean(l && l.trim()));
}
