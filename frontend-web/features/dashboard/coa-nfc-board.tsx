"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";

import { useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Fingerprint,
  History,
  ScanLine,
  UserRoundCheck,
  Link2,
  ShieldCheck,
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
import { NfcArtworkPassportView } from "@/features/verify/nfc-artwork-passport-view";
import { LinkNfcDialog } from "./link-nfc-dialog";

type ArtistArtwork = NonNullable<
  ReturnType<typeof useArtistDashboardArtworks>["data"]
>[number];

export function CoaNfcBoard() {
  const { data: me } = useCurrentUser();
  const { data: artworks } = useArtistDashboardArtworks();
  const [previewing, setPreviewing] = useState<ArtistArtwork | null>(null);
  const [transferring, setTransferring] = useState<ArtistArtwork | null>(null);
  const [linkingNfc, setLinkingNfc] = useState<ArtistArtwork | null>(null);
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

              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                {artwork.nfcTagId && (
                  <div className="mr-3 hidden flex-col items-end sm:flex">
                    <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
                      Public verify URL (written to tag)
                    </p>
                    <a
                      href={`/verify/${artwork.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 text-xs font-medium text-gold-bright transition-colors hover:text-gold hover:underline"
                    >
                      localhost:3001/verify/{artwork.id}
                    </a>
                  </div>
                )}

                <NfcPill tagged={Boolean(artwork.nfcTagId)} />

                {!artwork.nfcTagId && (
                  <button
                    id={`link-nfc-${artwork.id}`}
                    type="button"
                    onClick={() => setLinkingNfc(artwork)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20"
                  >
                    <Link2 className="size-3.5" />
                    Link Tag
                  </button>
                )}

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

      {linkingNfc && (
        <LinkNfcDialog
          open={Boolean(linkingNfc)}
          onOpenChange={(open) => {
            if (!open) setLinkingNfc(null);
          }}
          artworkId={linkingNfc.id}
          artworkTitle={linkingNfc.title}
        />
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
            resolveCustody(transferring).legalOwnerName ?? me?.name ?? ""
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
          ? "border-gold/40 bg-gold/10 text-gold-bright"
          : "border-border bg-secondary text-muted-foreground",
      )}
    >
      {tagged ? (
        <ShieldCheck className="size-3" strokeWidth={2} />
      ) : (
        <ScanLine className="size-3" strokeWidth={2} />
      )}
      {tagged ? "NFC Tagged" : "Not yet tagged"}
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
      <DialogContent className="max-h-[90dvh] flex flex-col overflow-y-auto overflow-x-hidden p-0 sm:max-w-[440px] bg-background border-gold/20">
        <DialogTitle className="sr-only">Certificate of Authenticity</DialogTitle>
        {artwork ? (
          <div className="relative w-full">
            <NfcArtworkPassportView artworkId={artwork.id} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
