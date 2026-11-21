// Shared PDFKit primitives for every GalleryZone document (tax invoice,
// purchase-cum-payment bill, delivery challan, aggregator commission
// invoice). Keep every renderer importing from here so fonts, borders,
// margins, Rs. formatting and amount-in-words stay identical across
// every document the company produces.
//
// Every doc uses:
//   - A4 size, 36pt margins
//   - Helvetica family (pdfkit built-in, no TTF shipping)
//   - "Rs. X,XX,XXX.XX" money format (₹ glyph isn't in Helvetica)
//   - Explicit (x, y) placement via textAt() — no continued-text flows
//     (those cause invisible page spills we've been bitten by once)

import { resolve } from "node:path";

/** 36pt page margins on A4. */
export const PAGE_MARGIN = 36;

export const COLOR_TEXT = "#111111";
export const COLOR_MUTED = "#555555";
export const COLOR_BORDER = "#9a9a9a";

/** Absolute path to the GalleryZone logo (black-on-white version used on
 *  every doc). Primitive consumers should existsSync() this at module
 *  load so a missing-file render falls back to a text letterhead. */
export const LOGO_PATH = resolve(
  import.meta.dirname,
  "..",
  "assets",
  "invoice-logo.png",
);

/** Sai Pawan's handwritten signature PNG for "Authorized Signatory". */
export const SIGNATURE_PATH = resolve(
  import.meta.dirname,
  "..",
  "assets",
  "invoice-signatory.png",
);

/** The currency marker every amount uses on every doc. */
export const MONEY = (paise: number) => `Rs. ${formatPaise(paise)}`;

// --- Text placement -----------------------------------------------------

export interface TextOpts {
  font?: string;
  size?: number;
  color?: string;
  lineHeight?: number;
  /** false → one line only (no wrap). Default true. */
  wrap?: boolean;
}

/** Explicit-coordinate text block. No continued flows, no implicit
 *  cursor advancement — the caller stays in control of Y, which is
 *  what keeps documents on a single page. */
export function textAt(
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

// --- Lines / rules ------------------------------------------------------

export function drawHline(
  doc: PDFKit.PDFDocument,
  x1: number,
  x2: number,
  y: number,
): void {
  doc.strokeColor(COLOR_BORDER).lineWidth(0.5).moveTo(x1, y).lineTo(x2, y).stroke();
}

export function drawVline(
  doc: PDFKit.PDFDocument,
  x: number,
  y1: number,
  y2: number,
): void {
  doc.strokeColor(COLOR_BORDER).lineWidth(0.5).moveTo(x, y1).lineTo(x, y2).stroke();
}

export function pageLeftOf(doc: PDFKit.PDFDocument): number {
  return doc.page.margins.left;
}

export function pageRightOf(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.right;
}

// --- Formatting ---------------------------------------------------------

export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(d: Date): string {
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

/** Two-digit GST state code for the given full state name. Returns ""
 *  for unknown states so callers can skip the field. */
export function stateDisplayCode(state: string): string {
  const upper = (state ?? "").trim().toUpperCase();
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

// --- Amount in words (Indian numbering: lakh / crore) -------------------

export function amountInWords(paise: number): string {
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
