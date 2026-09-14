import { jsPDF } from "jspdf";
import { artworkQrDataUrl } from "@/lib/qr";
import { verifyUrlFor } from "@/lib/verify-url";

const PAGE_WIDTH = 210; // A4, mm
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

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
  /** Current legal owner as recorded on the passport. */
  ownerName: string;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

// Renders the digital Certificate of Authenticity client-side from the
// same passport data the /verify page shows (same precedent as
// features/mou/mou-pdf.ts). The QR in the corner resolves to that public
// page, so a printed copy is verifiable by anyone with a phone. It is a
// record of what GalleryZone registered — the hand-signed paper version
// (MOU §12) is requested separately and physically signed by the artist.
export async function downloadCoaPdf(input: CoaPdfInput): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const gold: [number, number, number] = [176, 132, 58];
  const ink: [number, number, number] = [26, 22, 18];
  const muted: [number, number, number] = [110, 104, 96];

  // Border
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.6);
  doc.rect(10, 10, PAGE_WIDTH - 20, PAGE_HEIGHT - 20);
  doc.setLineWidth(0.2);
  doc.rect(12.5, 12.5, PAGE_WIDTH - 25, PAGE_HEIGHT - 25);

  let y = 34;
  doc.setTextColor(...gold);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("G A L L E R Y Z O N E", PAGE_WIDTH / 2, y, { align: "center" });
  y += 12;

  doc.setTextColor(...ink);
  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.text("Certificate of Authenticity", PAGE_WIDTH / 2, y, { align: "center" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...muted);
  doc.text(`Certificate No. ${input.coaCertificateNumber}`, PAGE_WIDTH / 2, y, { align: "center" });
  y += 14;

  doc.setDrawColor(...gold);
  doc.line(PAGE_WIDTH / 2 - 15, y, PAGE_WIDTH / 2 + 15, y);
  y += 12;

  doc.setTextColor(...muted);
  doc.setFontSize(10);
  doc.text("This certifies that the artwork", PAGE_WIDTH / 2, y, { align: "center" });
  y += 12;

  doc.setTextColor(...ink);
  doc.setFont("times", "bolditalic");
  doc.setFontSize(20);
  const titleLines = doc.splitTextToSize(input.title, CONTENT_WIDTH) as string[];
  doc.text(titleLines, PAGE_WIDTH / 2, y, { align: "center" });
  y += titleLines.length * 9 + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...muted);
  doc.text(`by ${input.artistName}`, PAGE_WIDTH / 2, y, { align: "center" });
  y += 14;

  doc.setFontSize(10);
  doc.setTextColor(...ink);
  const details: [string, string][] = [
    ["Product code", input.productCode || "—"],
    ["Category", input.category],
    ["Medium", input.medium],
    ["Dimensions", input.dimensions ?? "—"],
    ["Year", input.yearCreated ? String(input.yearCreated) : "—"],
    ["Certificate issued", formatDate(input.coaIssueDate)],
    ["Registered legal owner", input.ownerName],
  ];
  const labelX = MARGIN + 12;
  const valueX = PAGE_WIDTH / 2 + 4;
  for (const [label, value] of details) {
    doc.setTextColor(...muted);
    doc.text(label, labelX, y);
    doc.setTextColor(...ink);
    const lines = doc.splitTextToSize(value, PAGE_WIDTH - MARGIN - valueX) as string[];
    doc.text(lines, valueX, y);
    y += Math.max(1, lines.length) * 6.5;
  }
  y += 8;

  doc.setTextColor(...muted);
  doc.setFontSize(9);
  const statement = doc.splitTextToSize(
    "is an original work registered on GalleryZone. Its provenance — the chain of legal ownership from the artist onward — is recorded on the platform's ledger and can be verified at any time by scanning the code below or visiting the address beneath it. This digital certificate reflects the record as of the date of download; the hand-signed paper certificate issued by the artist on request is the physical counterpart of this record.",
    CONTENT_WIDTH - 10,
  ) as string[];
  doc.text(statement, PAGE_WIDTH / 2, y, { align: "center" });
  y += statement.length * 4.5 + 10;

  // QR + verify URL
  const qrSize = 38;
  try {
    const qr = await artworkQrDataUrl(input.artworkId, 512);
    doc.addImage(qr, "PNG", PAGE_WIDTH / 2 - qrSize / 2, y, qrSize, qrSize);
  } catch {
    // No QR image just means the URL line below is the only pointer — still verifiable.
  }
  y += qrSize + 6;
  doc.setFontSize(8.5);
  doc.setTextColor(...gold);
  doc.text(verifyUrlFor(input.artworkId), PAGE_WIDTH / 2, y, { align: "center" });
  y += 5;
  doc.setTextColor(...muted);
  doc.text("Scan to verify authenticity and current ownership", PAGE_WIDTH / 2, y, { align: "center" });

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text(
    `Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())} · GalleryZone acts as an intermediary; title passes directly from seller to buyer.`,
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 16,
    { align: "center" },
  );

  doc.save(`GalleryZone-CoA-${input.coaCertificateNumber}.pdf`);
}
