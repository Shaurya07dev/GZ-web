import Image from "next/image";
import { ShieldCheck } from "lucide-react";

interface ArtworkPassportCardProps {
  title: string;
  artistName: string;
  coverImageUrl: string;
  coaCertificateNumber: string;
  coaIssueDate: string;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

// Certificate-styled treatment for the Verify / Artwork Passport page
// (Task 17 Step 1) — deliberately ceremonial rather than a normal content
// card: gold border, a radial-glow + fine line-art motif reusing the same
// visual language as SiteFooter's FooterGlow (dotted texture, soft gold
// blooms, thin arcing strokes) for continuity, since that component isn't
// exported and this card has different proportions to fill.
export function ArtworkPassportCard({
  title,
  artistName,
  coverImageUrl,
  coaCertificateNumber,
  coaIssueDate,
}: ArtworkPassportCardProps) {
  return (
    <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-gold/40 bg-card p-px shadow-[0_0_60px_-15px_rgba(201,154,74,0.25)]">
      <div className="relative overflow-hidden rounded-[calc(1rem-1px)] bg-card">
        <PassportGlow />

        <div className="relative z-10 flex flex-col items-center px-8 py-10 text-center sm:px-12 sm:py-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-medium tracking-[0.14em] text-gold-bright uppercase">
            <ShieldCheck className="size-3.5" strokeWidth={2} />
            Artwork Passport
          </span>

          <div className="relative mt-7 size-40 overflow-hidden rounded-lg border border-gold/30 sm:size-48">
            <Image
              src={coverImageUrl}
              alt={title}
              fill
              sizes="192px"
              className="object-cover"
            />
          </div>

          <h1 className="mt-6 text-balance font-display text-2xl leading-[1.2] font-semibold text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            by <span className="text-foreground/90">{artistName}</span>
          </p>

          <span className="mt-6 h-px w-16 bg-gold/50" aria-hidden="true" />

          <dl className="mt-6 grid w-full grid-cols-2 gap-x-6 gap-y-4 text-left sm:max-w-sm">
            <div>
              <dt className="text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
                Certificate No.
              </dt>
              <dd className="mt-1 font-display text-sm font-medium tabular-nums text-gold-bright">
                {coaCertificateNumber}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
                Issued
              </dt>
              <dd className="mt-1 font-display text-sm font-medium text-foreground">
                {formatDate(coaIssueDate)}
              </dd>
            </div>
          </dl>

          <p className="mt-7 max-w-sm text-xs leading-relaxed text-muted-foreground">
            This digital passport confirms the piece above as an original,
            authenticated work registered with GalleryZone. It resolves the same
            NFC/QR tag physically attached to the artwork.
          </p>
        </div>
      </div>
    </div>
  );
}

function PassportGlow() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />
      <div className="absolute top-0 left-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/15 blur-[120px]" />
      <div className="absolute -right-16 -bottom-24 size-[320px] rounded-full bg-gold/15 blur-[90px]" />
      <svg viewBox="0 0 400 400" className="absolute inset-0 size-full">
        <circle
          cx="200"
          cy="200"
          r="170"
          fill="none"
          stroke="var(--gold)"
          strokeOpacity="0.14"
          strokeWidth="1"
        />
        <circle
          cx="200"
          cy="200"
          r="150"
          fill="none"
          stroke="var(--gold)"
          strokeOpacity="0.1"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
      </svg>
    </div>
  );
}
