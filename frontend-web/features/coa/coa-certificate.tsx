"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useArtwork } from "@/hooks/useArtwork";
import { useVerifyPassport } from "@/hooks/useVerify";
import { artworkQrDataUrl } from "@/lib/qr";
import { cn } from "@/lib/utils";
import { DownloadCoaButton } from "./download-coa-button";
import { DisplayCardView, labelize } from "./display-card";
import {
  CERT_NO_BASELINE,
  DATE_BASELINE,
  DATE_CENTER_X,
  FIELD_VALUE_MAX_W,
  FIELD_VALUE_X,
  QR_SIZE,
  QR_X,
  QR_Y,
  SIG_BOTTOM,
  SIG_CENTER_X,
  SIG_MAX_H,
  SIG_MAX_W,
  TPL_H,
  TPL_W,
  coaFieldRows,
  formatDate,
  type CoaPdfInput,
} from "./coa-pdf";

// The Certificate of Authenticity as it is printed, shown on screen: the designed template with every
// value placed at the same measured positions the PDF uses (coa-pdf.ts), so what you see is what you
// download. Everything is positioned in template pixels as a percentage of the image, and type is sized
// in container-width units, so it scales cleanly from a phone to a wide dialog.

const x = (px: number) => `${(px / TPL_W) * 100}%`;
const y = (px: number) => `${(px / TPL_H) * 100}%`;
/** jsPDF point size at the PDF's page width (297 mm) → container-width units. */
const cqw = (pt: number) => `${pt * 0.1188}cqw`;

/** Mirrors fitText() in coa-pdf.ts: the PDF shrinks long values before truncating; this steps the size down by length. */
const valuePt = (text: string) => (text.length > 34 ? 8.5 : text.length > 28 ? 9.5 : text.length > 22 ? 10.5 : 12);

export function CoaCertificate({ input, className }: { input: CoaPdfInput; className?: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    // The same code the PDF prints (coa-pdf.ts), so what is previewed is what is printed.
    artworkQrDataUrl(input.artworkId, 640, "Q")
      .then((u) => live && setQr(u))
      .catch((error) => {
        // A failed QR used to be swallowed, leaving the printed COA with
        // a blank verification code — the one thing that makes the
        // certificate scannable. Loud is better than silent here.
        console.error("COA QR generation failed", { artworkId: input.artworkId, error });
      });
    return () => {
      live = false;
    };
  }, [input.artworkId]);

  return (
    <div
      className={cn("relative w-full select-none overflow-hidden rounded-lg shadow-2xl shadow-black/50", className)}
      style={{ aspectRatio: `${TPL_W} / ${TPL_H}`, containerType: "inline-size", fontFamily: "var(--font-certificate)", color: "var(--coa-ink)" }}
    >
      <Image src="/coa-template.png" alt="Certificate of Authenticity" width={TPL_W} height={TPL_H} priority className="h-full w-full" />

      {coaFieldRows(input).map(([baseline, value]) => (
        <span
          key={baseline}
          className="absolute overflow-hidden text-ellipsis whitespace-nowrap leading-none"
          style={{ left: x(FIELD_VALUE_X), top: y(baseline), maxWidth: x(FIELD_VALUE_MAX_W), fontSize: cqw(valuePt(value)), transform: "translateY(-80%)" }}
        >
          {value}
        </span>
      ))}

      <span className="absolute whitespace-nowrap leading-none" style={{ left: x(DATE_CENTER_X), top: y(DATE_BASELINE), fontSize: cqw(11), transform: "translate(-50%, -80%)" }}>
        {formatDate(input.coaIssueDate)}
      </span>
      {input.coaCertificateNumber && (
        <span className="absolute whitespace-nowrap leading-none" style={{ left: x(DATE_CENTER_X), top: y(CERT_NO_BASELINE), fontSize: cqw(8), color: "var(--coa-ink-2)", transform: "translate(-50%, -80%)" }}>
          {input.coaCertificateNumber}
        </span>
      )}

      {qr && (
        // eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing for next/image to optimise
        <img src={qr} alt="QR code to verify this artwork" className="absolute" style={{ left: x(QR_X), top: y(QR_Y), width: x(QR_SIZE), height: y(QR_SIZE) }} />
      )}

      {input.artistSignatureDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a data: URL
        <img
          src={input.artistSignatureDataUrl}
          alt="Artist's signature"
          className="absolute object-contain object-bottom"
          style={{ left: x(SIG_CENTER_X - SIG_MAX_W / 2), top: y(SIG_BOTTOM - SIG_MAX_H), width: x(SIG_MAX_W), height: y(SIG_MAX_H) }}
        />
      )}
    </div>
  );
}

/** Loads one artwork's certificate data (the same sources the passport page uses) and shows the certificate with its download button. */
export type PaperTab = "certificate" | "card";

/** `artworkType` (the regional tradition, e.g. "Bihar: Madhubani (Mithila) Painting") is only on the artist's own
 *  records, not the public API, so the artist's page passes it in; without it the card shows the category. */
export function ArtworkCertificate({
  artworkId,
  initialTab = "certificate",
  artworkType,
}: {
  artworkId: string;
  initialTab?: PaperTab;
  artworkType?: string | null;
}) {
  const [tab, setTab] = useState<PaperTab>(initialTab);
  const { data: artwork, isLoading } = useArtwork(artworkId);
  const { data: passport, isLoading: passportLoading } = useVerifyPassport(artworkId);

  if (isLoading || passportLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (!artwork) return <p className="py-16 text-center text-sm text-muted-foreground">Certificate not found.</p>;

  const certificate: CoaPdfInput = {
    artworkId: artwork.id,
    productCode: passport?.productCode,
    title: artwork.title,
    artistName: artwork.artistName,
    artistSignatureDataUrl: passport?.artistSignatureDataUrl ?? null,
    category: artwork.category,
    medium: artwork.medium,
    dimensions: artwork.dimensions,
    yearCreated: artwork.yearCreated,
    coaCertificateNumber: passport?.coaCertificateNumber ?? "",
    coaIssueDate: passport?.coaIssuedAt ?? "",
    ownerName: passport?.owner.displayName ?? "",
    exclusive: artwork.exclusive,
  };

  const tabs: [PaperTab, string][] = [["certificate", "Certificate"], ["card", "Display card"]];

  return (
    <div className="flex flex-col items-center gap-4">
      <div role="tablist" className="inline-flex rounded-full border border-border p-0.5">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("rounded-full px-4 py-1.5 text-xs font-medium transition-colors", tab === id ? "bg-gold/20 text-gold-bright" : "text-muted-foreground hover:text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "certificate" ? (
        <>
          <CoaCertificate input={certificate} />
          <DownloadCoaButton certificate={certificate} />
        </>
      ) : (
        <DisplayCardView
          input={{
            artworkId: artwork.id,
            title: artwork.title,
            description: artwork.description,
            artForm: labelize(artworkType || artwork.category),
            medium: labelize(artwork.medium),
            size: artwork.dimensions ?? "—",
            artworkCode: passport?.productCode || artwork.id,
            artistName: artwork.artistName,
          }}
        />
      )}
    </div>
  );
}
