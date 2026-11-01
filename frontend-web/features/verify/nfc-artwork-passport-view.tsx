"use client";

/* Hallmark · genre: editorial · macrostructure: Photographic · theme: GalleryZone brand tokens (dark default, light) · enrichment: none · nav: N9 · footer: Ft2
 * pre-emit critique: P4 H4 E4 S5 R4 V5 · contrast: pass (40-41, axe clean in both themes) · nav/footer: pass (42-45)
 * honest: pass (46) · chrome: pass (47) · tokens: pass (48) · responsive: pass (49) · mobile: pass (34, 49, 50-57 at 13 widths, 320-1920) · icons: pass (30) */

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CircleCheck, LockOpen } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CoaCertificate } from "@/features/coa/coa-certificate";
import type { CoaPdfInput } from "@/features/coa/coa-pdf";
import { DownloadCoaButton } from "@/features/coa/download-coa-button";
import { useArtistProfile } from "@/hooks/useArtistProfile";
import { useArtwork } from "@/hooks/useArtwork";
import { useArtworkTransfers } from "@/hooks/useOwnershipTransfers";
import { useVerifyPassport } from "@/hooks/useVerify";
import { cn } from "@/lib/utils";
import { verifyUrlFor } from "@/lib/verify-url";
import { CUSTODY_PARTY_LABEL, activeDisplayTransfer, resolveCustody } from "@/types/artwork";
import { NfcLifecycleTimeline } from "./lifecycle-timeline";
import { OwnershipHistory } from "./ownership-history";
import { PassportPlate } from "./passport-plate";
import { ShareRecordButton } from "./tag-link";

// The page a tapped NFC tag or a scanned QR code lands on: the public record of one physical painting.
//
// It is read mostly on a phone, by someone standing next to the painting who wants to know whether it is the
// real piece. So the order is the order of that question: the verdict first (one quiet line), then the painting
// itself, large, with its label; then where it is and everything that has happened to it; then the certificate,
// shown as the document it is; then who made it.
//
// The design is a museum object page rather than a dashboard: the artwork is the biggest thing on screen, the text
// is a small exact label, and nothing competes with it (no cards, no glow, no badges laid over the image).
//   Edges:   art and documents are square (2px); controls are pills; portraits are round.
//   Colour:  the site's own tokens. Gold is used only where it means something: the verdict, the latest step of the
//            record, links, and the one outline button. Secondary text and hairlines are derived from the page
//            colours (see the passport tokens in globals.css), so they pass contrast in both themes.
//   Type:    Playfair Display for the title and headings, Inter for everything read as text, tabular figures
//            wherever numbers line up.
//   Motion:  one entrance (.pp-in), a tick that draws once, and the provenance thread that draws once when it
//            scrolls into view. Nothing loops and nothing moves on hover. Reduced motion gets opacity only.

const PAGE = "mx-auto w-full max-w-[1180px] px-5 sm:px-8";
const H2 = "font-display text-[1.75rem] leading-tight font-medium tracking-[-0.01em] [font-variant-numeric:lining-nums]";
const TEXT_LINK =
  "inline-flex min-h-11 items-center text-sm font-medium text-foreground underline decoration-1 decoration-passport-rule underline-offset-2 transition-colors duration-150 hover:decoration-gold-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

const longDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" });
const sentence = (text: string) => {
  const t = text.trim().replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const at = (i: number) => ({ "--i": i }) as React.CSSProperties;

function TopBar() {
  return (
    <header className={cn(PAGE, "flex h-16 items-center justify-between")}>
      <Link href="/" aria-label="GalleryZone home" className={cn("flex items-center gap-2.5", FOCUS_RING)}>
        {/* The app icon's mark, so the page a tag opens and the app it can open agree. */}
        <Image src="/brand/gz-app-icon.png" alt="" width={40} height={40} priority className="size-10 rounded-[10px]" />
        <span className="font-display text-lg font-medium tracking-[-0.01em]">GalleryZone</span>
      </Link>
      <p className="text-sm text-passport-ink-2">Artwork Passport</p>
    </header>
  );
}

// The verdict, said once. A locked tag is the strongest claim the page can make, so it is the only thing in gold
// up here; a tag that is linked but not locked could still be rewritten, so it is not presented as sealed.
function StatusBand({ locked }: { locked: boolean }) {
  return (
    <div role="status" className="pp-in border-y border-passport-rule" style={at(0)}>
      {/* The icon sits in a column as wide as the logo above it, so the verdict starts where the wordmark does. */}
      <div className={cn(PAGE, "flex h-14 items-center gap-2.5 text-[0.9375rem] font-medium")}>
        <span className="flex w-10 shrink-0 justify-center" aria-hidden="true">
          {locked ? (
            <CircleCheck className="pp-tick size-5 text-gold-bright" strokeWidth={1.75} />
          ) : (
            <LockOpen className="size-5 text-passport-ink-2" strokeWidth={1.75} />
          )}
        </span>
        {/* The chip's own ID is never public: only whether it is linked and locked. */}
        <span id="passport-nfc-chip" className={locked ? "text-gold-bright" : "text-passport-ink-2"}>
          {locked ? "Verified via NFC + locked" : "NFC tag linked, not yet locked"}
        </span>
      </div>
    </div>
  );
}

function PassportSkeleton() {
  return (
    <div className="passport relative">
      <TopBar />
      <main aria-busy="true" className={cn(PAGE, "grid gap-8 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end lg:gap-16")}>
        <Skeleton className="h-[min(52dvh,26rem)] rounded-[2px] sm:h-[min(62dvh,34rem)] lg:h-[min(72dvh,52rem)]" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-11 w-4/5" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="mt-8 h-24 w-full" />
        </div>
      </main>
    </div>
  );
}

// The certificate is a landscape document set in small type. On a phone it reads as a picture of one, so tapping it
// opens it wide enough to read, and the sheet pans sideways.
function CertificatePanel({ input }: { input: CoaPdfInput }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="View the certificate full size"
          className={cn("block w-full cursor-zoom-in text-left", FOCUS_RING)}
        >
          <CoaCertificate input={input} className="rounded-[2px] shadow-none ring-1 ring-passport-rule" />
        </button>
        <DialogContent className="h-[90dvh] max-w-[min(96vw,1280px)] overflow-auto rounded-[2px] border-none bg-background p-3 ring-0 sm:max-w-[min(96vw,1280px)] sm:p-6">
          <DialogTitle className="sr-only">Certificate of Authenticity, full size</DialogTitle>
          <div className="min-w-[860px]">
            <CoaCertificate input={input} className="rounded-[2px] shadow-none ring-1 ring-passport-rule" />
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
        <DownloadCoaButton certificate={input} className="min-h-11 rounded-full px-5 whitespace-nowrap" />
        <button type="button" onClick={() => setOpen(true)} className={cn(TEXT_LINK, "cursor-pointer")}>
          View full size
        </button>
      </div>
    </div>
  );
}

export function NfcArtworkPassportView({ artworkId }: { artworkId: string }) {
  const { data: artwork, isLoading } = useArtwork(artworkId);
  const { data: passport, isLoading: passportLoading } = useVerifyPassport(artworkId);
  const { data: artist } = useArtistProfile(artwork?.artistId ?? "");
  const { data: transfers } = useArtworkTransfers(artworkId);

  if (isLoading || passportLoading) return <PassportSkeleton />;
  if (!artwork) notFound();

  // The marketplace listing doesn't carry the certificate; the passport does.
  const coaNumber = passport?.coaCertificateNumber ?? "";
  const coaIssued = passport?.coaIssuedAt ?? "";

  const custody = resolveCustody(artwork);
  const ownerName = passport?.owner.displayName ?? custody.legalOwnerName ?? CUSTODY_PARTY_LABEL[custody.legalOwner];
  const hasNfc = Boolean(passport?.nfcLinked);
  const nfcLocked = Boolean(passport?.nfcLocked);
  const images = artwork.images.length
    ? artwork.images
    : [{ url: artwork.thumbnailUrl, thumbnailUrl: artwork.thumbnailUrl, sortOrder: 0, altText: artwork.title }];

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
    coaCertificateNumber: coaNumber,
    coaIssueDate: coaIssued,
    ownerName,
    exclusive: artwork.exclusive,
  };

  const specs = [
    ["Medium", artwork.medium],
    ["Size", artwork.dimensions],
    ["Year", artwork.yearCreated ? String(artwork.yearCreated) : null],
    ["Art form", artwork.category ? sentence(artwork.category) : null],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  // resolveCustody() guesses from the artwork's status, which is a stopgap (see types/artwork.ts) and says "Awaiting
  // delivery" for a piece that has long since arrived. The provenance record knows better, so it overrides the guess:
  // a running display loan means the host holds the piece, and a delivery means the collector does.
  const onDisplay = activeDisplayTransfer((transfers ?? []).filter((t) => t.status !== "cancelled"));
  const delivered = (passport?.lifecycle ?? []).some((step) => step.kind === "delivered");
  const heldBy = onDisplay ? onDisplay.toName : delivered ? CUSTODY_PARTY_LABEL.customer : CUSTODY_PARTY_LABEL[custody.custodian];
  const location = onDisplay ? "On display" : delivered ? "With the collector" : custody.locationLabel;

  const custodyFacts: [string, string][] = [
    ["Owner", ownerName],
    ["Held by", heldBy],
    ["Location", location],
  ];

  const artistName = artist?.name ?? artwork.artistName;
  const portrait = artist?.profileImageUrl?.trim();
  // The detail endpoint does not always carry the artist's place; their profile does.
  const place = artist?.location?.trim() || artwork.artistLocation;

  return (
    <div className="passport relative">
      <TopBar />
      {hasNfc && <StatusBand locked={nfcLocked} />}

      <main>
        {/* ── The painting and its label ────────────────────────────────────────────── */}
        <section className={cn(PAGE, "pt-6 sm:pt-10")}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-stretch lg:gap-16">
            <PassportPlate images={images} title={artwork.title} />

            <div className="flex flex-col gap-9 lg:justify-between lg:gap-12 lg:pb-3">
              <div className="flex flex-col gap-4">
                <h1
                  className="pp-in min-w-0 font-display text-[clamp(1.75rem,1.1rem+2.6vw,2.875rem)] leading-[1.1] font-medium tracking-[-0.015em] text-balance [font-variant-numeric:lining-nums] [overflow-wrap:anywhere]"
                  style={at(2)}
                >
                  {artwork.title}
                </h1>
                <div className="pp-in" style={at(3)}>
                  <Link
                    href={`/artists/${artwork.artistId}`}
                    className="text-lg font-medium text-foreground underline decoration-1 decoration-passport-rule underline-offset-2 transition-colors duration-150 hover:decoration-gold-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {artwork.artistName}
                  </Link>
                  {place && <p className="mt-1.5 text-base text-passport-ink-2">{place}</p>}
                </div>
              </div>

              <div className="flex flex-col gap-9">
                {specs.length > 0 && (
                  <dl className="pp-in grid grid-cols-[5rem_minmax(0,1fr)] gap-x-6 gap-y-3 text-base" style={at(4)}>
                    {specs.map(([label, value]) => (
                      <div key={label} className="contents">
                        <dt className="text-passport-ink-2">{label}</dt>
                        <dd className="font-medium tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                <div className="pp-in flex flex-col gap-1 border-t border-passport-rule pt-6" style={at(5)}>
                  <p className="text-sm text-passport-ink-2">Certificate of Authenticity</p>
                  <p className="text-lg font-medium tabular-nums">{coaNumber || "Not issued yet"}</p>
                  {coaIssued && <p className="text-sm text-passport-ink-2">Certificate issued {longDate.format(new Date(coaIssued))}</p>}
                </div>

                <div className="pp-in flex flex-wrap items-center gap-x-8 gap-y-1" style={at(6)}>
                  {coaNumber && (
                    <a href="#certificate" className={TEXT_LINK}>
                      See the certificate
                    </a>
                  )}
                  <Link href={`/marketplace/${artwork.id}`} className={TEXT_LINK}>
                    View listing
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Where it is, and everything that has happened to it ───────────────────── */}
        <section aria-labelledby="provenance-heading" className={cn(PAGE, "mt-24 sm:mt-32")}>
          <h2 id="provenance-heading" className={H2}>
            Provenance
          </h2>
          <div className="mt-10 grid gap-14 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
            <div className="flex flex-col gap-10">
              <dl className="flex flex-col gap-6">
                {custodyFacts.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm text-passport-ink-2">{label}</dt>
                    <dd className="mt-1 font-display text-[1.375rem] leading-tight [font-variant-numeric:lining-nums]">{value}</dd>
                  </div>
                ))}
              </dl>
              <OwnershipHistory artworkId={artwork.id} />
            </div>
            <NfcLifecycleTimeline entries={passport?.lifecycle ?? []} />
          </div>
        </section>

        {/* ── The certificate itself ──────────────────────────────────────────────────── */}
        {coaNumber && (
          <section id="certificate" aria-labelledby="certificate-heading" className={cn(PAGE, "mt-28 scroll-mt-6 sm:mt-36")}>
            <h2 id="certificate-heading" className={H2}>
              Certificate of Authenticity
            </h2>
            <div className="mt-10">
              <CertificatePanel input={certificate} />
            </div>
          </section>
        )}

        {/* ── The artist ──────────────────────────────────────────────────────────────── */}
        {artwork.artistId && (
          <section aria-labelledby="artist-heading" className={cn(PAGE, "mt-24 sm:mt-28")}>
            <h2 id="artist-heading" className={H2}>
              The artist
            </h2>
            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-passport-mat ring-1 ring-passport-rule">
                  {portrait ? (
                    <Image src={portrait} alt="" fill sizes="64px" className="object-cover" />
                  ) : (
                    <span className="font-display text-xl text-passport-ink-2" aria-hidden="true">
                      {artistName.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-[1.375rem] leading-tight font-medium">{artistName}</p>
                  {artwork.verifiedArtist && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-gold-bright">
                      <BadgeCheck className="size-4 shrink-0" strokeWidth={1.75} />
                      Verified GalleryZone artist
                    </p>
                  )}
                  {artist?.headline && <p className="mt-1 text-base text-passport-ink-2">{artist.headline}</p>}
                </div>
              </div>
              <Link
                href={`/artists/${artwork.artistId}`}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-gold/60 px-5 text-sm font-medium whitespace-nowrap text-gold-bright transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-gold hover:bg-gold/10 active:scale-[0.98] motion-reduce:active:scale-100",
                  FOCUS_RING,
                )}
              >
                View portfolio
              </Link>
            </div>
          </section>
        )}
      </main>

      {/* ── Close ───────────────────────────────────────────────────────────────────────── */}
      <footer className={cn(PAGE, "mt-28 pb-16 sm:mt-36")}>
        <div className="flex flex-col gap-8 border-t border-passport-rule pt-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-[1.375rem] leading-snug font-medium">One tag. One artwork. One unbroken record.</p>
            <p className="mt-2 text-sm text-passport-ink-2">Authenticated by GalleryZone</p>
          </div>
          <ShareRecordButton url={verifyUrlFor(artwork.id)} title={`${artwork.title} by ${artwork.artistName}`} />
        </div>
      </footer>
    </div>
  );
}
