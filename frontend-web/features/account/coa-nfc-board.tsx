"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  ScanLine,
  Fingerprint,
  UserRoundCheck,
  ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useCollection } from "@/hooks/useCollection";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { CollectionItem } from "@/services/customerCollectionService";
import { TransferRightsDialog } from "@/features/verify/transfer-rights-dialog";
import { PhysicalCoaRequest } from "./physical-coa-request";
import { nfcStageOf, NFC_STAGE_LABEL } from "@/lib/nfc";

const PILL =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium";

// Buyer-side mirror of the artist's /dashboard/coa-nfc board. Every owned
// piece in one place, with its certificate, its tag, and the actions that
// are a buyer's to take: view the passport anyone else would scan, ask for
// the physical COA, and transfer rights to someone else. Reuses the same
// TransferRightsDialog + PhysicalCoaRequest the collection detail dialog
// uses — this view only exists to make them discoverable without having to
// drill into each piece.
export function CoaNfcBoard() {
  const { data: me } = useCurrentUser();
  const { data, isPending } = useCollection();
  const [transferring, setTransferring] = useState<CollectionItem | null>(null);

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const items = data ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Fingerprint}
        title="No certificates yet"
        description="Each owned piece ships with its digital certificate and a tag you can scan. Once an order is delivered, it will appear here."
        action={
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-md border border-gold/60 px-4 py-2 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
          >
            Browse the marketplace
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Certificates &amp; tags
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Every piece you own carries a Certificate of Authenticity, and
            physical pieces carry an NFC/QR tag. Transfer rights or request
            the printed certificate from here.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const stage = nfcStageOf(item.artwork);
            return (
              <article
                key={item.artwork.id}
                className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start"
              >
                <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-md sm:size-24">
                  <Image
                    src={item.artwork.thumbnailUrl}
                    alt={item.artwork.title}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex min-w-0 flex-col">
                    <p className="truncate font-display text-sm font-semibold text-foreground">
                      {item.artwork.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.artwork.artistName}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`${PILL} border-emerald-500/40 text-emerald-300`}>
                      <BadgeCheck className="size-3" strokeWidth={2} />
                      COA issued
                    </span>
                    <span
                      className={`${PILL} ${
                        stage === "linked_locked"
                          ? "border-gold/40 text-gold-bright"
                          : stage === "linked_unlocked"
                            ? "border-amber-500/40 text-amber-300"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      <ScanLine className="size-3" strokeWidth={2} />
                      {NFC_STAGE_LABEL[stage]}
                    </span>
                  </div>

                  <PhysicalCoaRequest
                    artworkId={item.artwork.id}
                    artworkTitle={item.artwork.title}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:w-44 sm:shrink-0">
                  <Link
                    href={`/verify/${item.artwork.id}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <ExternalLink className="size-3.5" />
                    View passport
                  </Link>
                  <button
                    type="button"
                    onClick={() => setTransferring(item)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gold/60 px-3 py-2 text-xs font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
                  >
                    <UserRoundCheck className="size-3.5" />
                    Transfer rights
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {transferring && (
        <TransferRightsDialog
          open={!!transferring}
          onOpenChange={(open) => !open && setTransferring(null)}
          artworkId={transferring.artwork.id}
          artworkTitle={transferring.artwork.title}
          fromName={me?.name ?? ""}
        />
      )}
    </>
  );
}
