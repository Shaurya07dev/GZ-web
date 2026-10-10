import { jsPDF } from "jspdf";
import { artworkQrDataUrl } from "@/lib/qr";

// The Certificate of Authenticity, rendered onto GalleryZone's designed
// certificate (public/coa-template.png) rather than drawn from scratch.
//
// Everything variable is overlaid on the template at measured positions, so
// the artwork there is the real thing an artist receives and nothing about
// the design lives in this file — only where each value sits on it.
//
// The artist's signature above the signature line is the one the artist drew
// when they signed their MOU, carried on the passport. A certificate with an
// empty signature area is not a certificate (owner's decision, 10 Oct 2026),
// so it is printed on every copy — including one downloaded from the public
// /verify page. The trade that was accepted to get there is recorded on
// `artistSignatureDataUrl` in verify-dto.ts: it is a handwritten signature
// served unauthenticated. An artist who signed before the signature pad
// existed has none, and the line is simply left blank for a wet signature.
//
// The gold "VERIFIED ARTWORK" seal and the "AUTHORIZED SIGNATORY" block are
// part of the template — GalleryZone's own attestation, not per-artwork data.
//
// Ownership is not printed either, and that is on purpose: a certificate is
// a permanent object but ownership changes. The QR resolves to the live
// passport, so the piece of paper never goes stale or contradicts the ledger.

const TEMPLATE_URL = "/coa-template.png";

// The template's intrinsic pixel size. Every coordinate below is expressed in
// these pixels — measured off the artwork — and scaled to the page at render
// time, so the positions stay readable and stay correct if the page size
// changes.
const TPL_W = 1280;
const TPL_H = 853;

/** Page width in mm; the height follows the template's aspect so nothing is stretched. */
const PAGE_W = 297;
const PAGE_H = (PAGE_W * TPL_H) / TPL_W;
const PX = PAGE_W / TPL_W;

/** Template pixels → page mm. */
const mm = (px: number): number => px * PX;

// --- measured positions on the template ------------------------------------

/** Baseline of each of the seven ruled fields, and where their values start. */
const FIELD_VALUE_X = 366;
const FIELD_VALUE_MAX_W = 196; // the ruled line ends at ~562px
const FIELD_BASELINES = {
  artistName: 402,
  title: 446,
  artForm: 487,
  medium: 529,
  dimensions: 573,
  yearCreated: 615,
  artworkId: 658,
} as const;

/** Bottom-left "DATE OF ISSUE" block — the label is on the template, the value goes under it. */
const DATE_CENTER_X = 233;
const DATE_BASELINE = 775;
const CERT_NO_BASELINE = 794;

/** The blank panel under "VERIFIED THIS ARTWORK", above the "Scan to verify…" caption. */
const QR_SIZE = 170;
const QR_X = 964;
const QR_Y = 432;

/**
 * The space above the printed "Artist Signature" label, between the bottom of
 * the declaration text and the label itself. The signature is fitted inside
 * this box keeping its own aspect ratio, so a wide scrawl and a tall one both
 * sit on the line rather than being stretched to fill it.
 */
const SIG_CENTER_X = 737;
const SIG_BOTTOM = 662;
const SIG_MAX_W = 180;
const SIG_MAX_H = 62;

const INK: [number, number, number] = [26, 22, 18];
const MUTED: [number, number, number] = [110, 104, 96];

export interface CoaPdfInput {
  artworkId: string;
  productCode?: string | null;
  title: string;
  artistName: string;
  category: string;
  medium: string;
  dimensions: string | null;
  yearCreated: number | null;
  coaCertificateNumber: string;
  coaIssueDate: string;
  /** Current legal owner. Not printed — see the note at the top of this file — but kept so callers need not change. */
  ownerName: string;
  /** The artist's drawn signature from their MOU, placed above the signature line. Null = the line is left for a wet signature. */
  artistSignatureDataUrl?: string | null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

/**
 * Loads the certificate artwork as a data URL.
 *
 * jsPDF needs the bytes, not a URL, so this fetches once per download. A
 * failure here is fatal and says so: a certificate rendered without its
 * template would be a page of floating text with no border, no seal and no
 * branding, which is worse than no certificate at all.
 */
async function loadTemplate(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(TEMPLATE_URL);
  } catch {
    throw new Error("Couldn't load the certificate design. Check your connection and try again.");
  }
  if (!response.ok) throw new Error("Couldn't load the certificate design. Please try again.");
  const buffer = await response.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  // Chunked so a ~1 MB image doesn't blow the argument limit of String.fromCharCode.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

/**
 * Draws a field value on its ruled line, shrinking the type only as far as it
 * has to before truncating. A long artwork title is common and must not run
 * over the rule into the declaration column.
 */
function fitText(doc: jsPDF, text: string, x: number, baseline: number, maxWidthPx: number, startSize = 12): void {
  const maxW = mm(maxWidthPx);
  let size = startSize;
  doc.setFontSize(size);
  while (doc.getTextWidth(text) > maxW && size > 8) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  let out = text;
  if (doc.getTextWidth(out) > maxW) {
    // Still too wide at the floor size — truncate rather than overrun.
    while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxW) out = out.slice(0, -1);
    out = `${out}…`;
  }
  doc.text(out, mm(x), mm(baseline));
  doc.setFontSize(startSize);
}

export async function downloadCoaPdf(input: CoaPdfInput): Promise<void> {
  const [template, qr] = await Promise.all([
    loadTemplate(),
    // A missing QR is survivable — every other field still identifies the
    // piece — so it must not take the whole certificate down with it.
    artworkQrDataUrl(input.artworkId, 1024).catch(() => null),
  ]);

  const doc = new jsPDF({ unit: "mm", format: [PAGE_W, PAGE_H], orientation: "landscape" });
  doc.addImage(template, "PNG", 0, 0, PAGE_W, PAGE_H, undefined, "FAST");

  // The seven ruled fields.
  doc.setTextColor(...INK);
  doc.setFont("times", "normal");
  const fields: [number, string][] = [
    [FIELD_BASELINES.artistName, input.artistName],
    [FIELD_BASELINES.title, input.title],
    [FIELD_BASELINES.artForm, input.category],
    [FIELD_BASELINES.medium, input.medium],
    [FIELD_BASELINES.dimensions, input.dimensions ?? "—"],
    [FIELD_BASELINES.yearCreated, input.yearCreated ? String(input.yearCreated) : "—"],
    [FIELD_BASELINES.artworkId, input.productCode || input.artworkId],
  ];
  for (const [baseline, value] of fields) {
    fitText(doc, value, FIELD_VALUE_X, baseline, FIELD_VALUE_MAX_W);
  }

  // Date of issue, under its printed label.
  doc.setFontSize(11);
  doc.text(formatDate(input.coaIssueDate), mm(DATE_CENTER_X), mm(DATE_BASELINE), { align: "center" });

  // The certificate's own number. The template has no field for it — "ARTWORK
  // ID" is the artwork's code, which is a different thing — so it sits
  // quietly under the date where it can still be quoted in correspondence.
  if (input.coaCertificateNumber) {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(input.coaCertificateNumber, mm(DATE_CENTER_X), mm(CERT_NO_BASELINE), { align: "center" });
    doc.setTextColor(...INK);
  }

  // The QR, in the panel the template reserves for it.
  if (qr) doc.addImage(qr, "PNG", mm(QR_X), mm(QR_Y), mm(QR_SIZE), mm(QR_SIZE));

  // The artist's signature, sitting on the line above its printed label.
  if (input.artistSignatureDataUrl) {
    try {
      const { width, height } = doc.getImageProperties(input.artistSignatureDataUrl);
      // Fit inside the box without distorting: scale by whichever axis binds
      // first. A signature stretched to fill a fixed box stops looking like
      // the person's hand, which is the only thing it is there to be.
      const scale = Math.min(SIG_MAX_W / width, SIG_MAX_H / height);
      const w = width * scale;
      const h = height * scale;
      doc.addImage(input.artistSignatureDataUrl, "PNG", mm(SIG_CENTER_X - w / 2), mm(SIG_BOTTOM - h), mm(w), mm(h));
    } catch {
      // An unreadable signature leaves the line blank for a wet signature,
      // which is the same place we were before it existed — never a failed
      // download.
    }
  }

  const name = input.coaCertificateNumber || input.productCode || input.artworkId;
  doc.save(`GalleryZone-CoA-${name}.pdf`);
}
