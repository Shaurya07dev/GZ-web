"use client";

import { useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Fingerprint,
  History,
  ScanLine,
  UserRoundCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useArtistDashboardArtworks } from "@/hooks/useArtistArtworks";
import { cn } from "@/lib/utils";
import { CUSTODY_PARTY_LABEL, resolveCustody } from "@/types/artwork";
import { TransferRightsDialog } from "@/features/verify/transfer-rights-dialog";
import { PhysicalCoaQueue } from "./physical-coa-queue";
import { DownloadCoaButton } from "@/features/coa/download-coa-button";
import { ArtworkHistory } from "./artwork-history";
import { ARTIST } from "./dashboard-data";

type ArtistArtwork = NonNullable<
  ReturnType<typeof useArtistDashboardArtworks>["data"]
>[number];

export function CoaNfcBoard() {
  const { data: artworks } = useArtistDashboardArtworks();
  const [previewing, setPreviewing] = useState<ArtistArtwork | null>(null);
  const [transferring, setTransferring] = useState<ArtistArtwork | null>(null);
  // History used to be reachable only by opening the certificate. It answers a
  // different question from "is this piece authentic" — where has it been — so
  // it gets its own button.
  const [viewingHistory, setViewingHistory] = useState<ArtistArtwork | null>(
    null,
  );

  const rows = artworks ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Certificates &amp; tags
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Every submitted artwork gets a Certificate of Authenticity;
          physical pieces also get an NFC/QR tag linked to it.
        </p>
      </div>

      <PhysicalCoaQueue />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Submit an artwork to generate its first certificate.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((artwork) => (
            <div
              key={artwork.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                  <Image
                    src={artwork.thumbnailUrl}
                    alt={artwork.title}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {artwork.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {artwork.coaCertificateNumber}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:shrink-0">
                <NfcPill tagged={Boolean(artwork.nfcTagId)} />
                <button
                  type="button"
                  onClick={() => setPreviewing(artwork)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <BadgeCheck className="size-3.5 text-gold-bright" />
                  Preview certificate
                </button>
                <button
                  type="button"
                  onClick={() => setViewingHistory(artwork)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <History className="size-3.5 text-gold-bright" />
                  History
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CertificateDialog
        artwork={previewing}
        onClose={() => setPreviewing(null)}
        onTransfer={(artwork) => {
          setPreviewing(null);
          setTransferring(artwork);
        }}
      />

      <HistoryDialog
        artwork={viewingHistory}
        onClose={() => setViewingHistory(null)}
      />

      {transferring && (
        <TransferRightsDialog
          open
          onOpenChange={(open) => !open && setTransferring(null)}
          artworkId={transferring.id}
          artworkTitle={transferring.title}
          fromName={
            resolveCustody(transferring).legalOwnerName ?? ARTIST.name
          }
        />
      )}
    </div>
  );
}

function HistoryDialog({
  artwork,
  onClose,
}: {
  artwork: ArtistArtwork | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(artwork)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] flex flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>History</DialogTitle>
        </DialogHeader>
        {artwork ? (
          <div className="flex-1 overflow-y-auto pr-2 -mr-2 flex flex-col gap-4">
            <p className="-mt-1 text-sm text-muted-foreground">
              {artwork.title}
            </p>
            <ArtworkHistory artwork={artwork} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NfcPill({ tagged }: { tagged: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        tagged
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-border bg-secondary text-muted-foreground",
      )}
    >
      <ScanLine className="size-3" strokeWidth={2} />
      {tagged ? "NFC tagged" : "Not yet tagged"}
    </span>
  );
}

function CertificateDialog({
  artwork,
  onClose,
  onTransfer,
}: {
  artwork: ArtistArtwork | null;
  onClose: () => void;
  onTransfer: (artwork: ArtistArtwork) => void;
}) {
  return (
    <Dialog
      open={Boolean(artwork)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-h-[85dvh] flex flex-col overflow-hidden sm:max-w-3xl">
        {artwork ? (
          <>
            <DialogHeader>
              <DialogTitle>Certificate of Authenticity</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-2 -mr-2 flex flex-col gap-4 pb-2">
              <div className="flex flex-col items-center gap-3 rounded-lg border border-gold/30 bg-gold/5 p-6 text-center">
                <Fingerprint className="size-8 text-gold-bright" strokeWidth={1.5} />
                <p className="font-display text-lg font-semibold text-foreground">
                  {artwork.title}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {artwork.coaCertificateNumber || "Number issued on approval"}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Issued</dt>
                  <dd className="text-foreground">
                    {artwork.coaIssueDate
                      ? new Date(artwork.coaIssueDate).toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short", year: "numeric" },
                        )
                      : "Pending approval"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">NFC tag</dt>
                  <dd className="text-foreground">
                    {artwork.nfcTagId ?? "Not yet attached"}
                  </dd>
                </div>
                {/* Owner, custodian and location are tracked separately — a
                    piece can be owned by one party while physically held by
                    another somewhere else again. */}
                <div>
                  <dt className="text-xs text-muted-foreground">Legal owner</dt>
                  <dd className="text-foreground">
                    {resolveCustody(artwork).legalOwnerName ??
                      CUSTODY_PARTY_LABEL[resolveCustody(artwork).legalOwner]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Physical custodian
                  </dt>
                  <dd className="text-foreground">
                    {CUSTODY_PARTY_LABEL[resolveCustody(artwork).custodian]}
                  </dd>
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-xs text-muted-foreground">Location</dt>
                  <dd className="text-foreground">
                    {resolveCustody(artwork).locationLabel}
                  </dd>
                </div>
              </dl>

              <DownloadCoaButton
                certificate={{
                  artworkId: artwork.id,
                  title: artwork.title,
                  artistName: artwork.artistName,
                  category: artwork.category,
                  medium: artwork.medium,
                  dimensions: artwork.dimensions,
                  yearCreated: artwork.yearCreated,
                  coaCertificateNumber: artwork.coaCertificateNumber,
                  coaIssueDate: artwork.coaIssueDate,
                  ownerName:
                    resolveCustody(artwork).legalOwnerName ??
                    CUSTODY_PARTY_LABEL[resolveCustody(artwork).legalOwner],
                }}
                className="self-start"
              />

              <ArtworkHistory artwork={artwork} />

              {/* First hand-over of the passport: artist to buyer. The buyer can
                  pass it on again later from their own collection. */}
              <button
                type="button"
                onClick={() => onTransfer(artwork)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gold/60 px-4 py-2.5 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10 mt-2"
              >
                <UserRoundCheck className="size-3.5" />
                Transfer rights
              </button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
