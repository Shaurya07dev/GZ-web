import { jsPDF } from "jspdf";
import type { MouDocument, MouAcceptanceRecord } from "./mou-agreement";

const PAGE_WIDTH = 210; // A4, mm
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PAGE_HEIGHT = 297;

// Renders the signed document client-side — there is no backend to generate
// this from, so the PDF is built from exactly the same MouDocument data the
// on-screen agreement reads, plus the acceptance record's drawn signature.
export function downloadMouPdf(
  document_: MouDocument,
  acceptance: MouAcceptanceRecord,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  function ensureSpace(lines: number, lineHeight = 5) {
    if (y + lines * lineHeight > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function writeParagraph(
    text: string,
    opts?: { size?: number; bold?: boolean; indent?: number },
  ) {
    const size = opts?.size ?? 10.5;
    const indent = opts?.indent ?? 0;
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent) as string[];
    ensureSpace(lines.length);
    doc.text(lines, MARGIN + indent, y);
    y += lines.length * (size / 2) + 2;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  ensureSpace(2, 7);
  doc.text(document_.title, MARGIN, y);
  y += 7;

  writeParagraph(`Version ${document_.version}`, { size: 9 });
  y += 2;

  for (const p of document_.preamble) writeParagraph(p);
  y += 2;

  for (const clause of document_.clauses) {
    y += 2;
    writeParagraph(`${clause.number}. ${clause.title}`, {
      bold: true,
      size: 11.5,
    });
    clause.paragraphs?.forEach((p) => writeParagraph(p));
    clause.points?.forEach((point) =>
      writeParagraph(`•  ${point}`, { indent: 3 }),
    );
    clause.closing?.forEach((p) => writeParagraph(p));
  }

  y += 2;
  writeParagraph("Declaration", { bold: true, size: 11.5 });
  document_.declaration.forEach((line) =>
    writeParagraph(`•  ${line}`, { indent: 3 }),
  );

  // Signature block, always started on its own space so it never runs into
  // the clause text above it.
  ensureSpace(10);
  y += 6;
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  writeParagraph(`Signed by: ${acceptance.signatureName}`, { bold: true });
  writeParagraph(
    `Signed on: ${new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(acceptance.acceptedAt))}`,
  );

  if (acceptance.signatureDataUrl) {
    ensureSpace(24);
    y += 2;
    try {
      doc.addImage(acceptance.signatureDataUrl, "PNG", MARGIN, y, 60, 24);
      y += 26;
    } catch {
      // A malformed data URL just means no signature image renders — the
      // typed name and timestamp above are still a complete record.
    }
  }

  doc.save(
    `GalleryZone-MOU-${document_.version}-${acceptance.signatureName.replace(/\s+/g, "-")}.pdf`,
  );
}
