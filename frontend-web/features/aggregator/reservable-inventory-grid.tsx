"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, PackageSearch } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PriceTag } from "@/components/shared/price-tag";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { useReservableInventory } from "@/hooks/useAggregatorInventory";
import { ReserveArtworkDialog } from "./reserve-artwork-dialog";
import type { ArtworkSummary } from "@/types/artwork";

// Same lower-bound verification treatment ArtworkCard uses -- ArtworkSummary
// only carries a boolean verifiedArtist, not the full tier count, so this is
// the honest ceiling for what can render here (see components/shared/
// artwork-card.tsx's identical comment).
const MINIMUM_VERIFICATION = {
  tier1SocialMedia: true,
  tier2ActivePlan: false,
  tier3FirstSale: false,
} as const;

export function ReservableInventoryGrid() {
  const { data, isPending, isError } = useReservableInventory();
  const [selected, setSelected] = useState<ArtworkSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function openReserveDialog(artwork: ArtworkSummary) {
    setSelected(artwork);
    setDialogOpen(true);
  }

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-border p-3.5">
            <Skeleton className="aspect-[4/5] w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="Couldn't load inventory"
        description="Something went wrong loading reservable artworks. Try refreshing the page."
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="No reservable artworks right now"
        description="Every marketplace-and-aggregator artwork is already claimed. Check back soon as new work is listed."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.map((artwork) => (
          <InventoryArtworkCard
            key={artwork.id}
            artwork={artwork}
            onReserve={() => openReserveDialog(artwork)}
          />
        ))}
      </div>

      <ReserveArtworkDialog
        artwork={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

function InventoryArtworkCard({
  artwork,
  onReserve,
}: {
  artwork: ArtworkSummary;
  onReserve: () => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors duration-200 ease-out hover:border-gold/50">
      <Link
        href={`/marketplace/${artwork.id}`}
        target="_blank"
        className="relative block aspect-[4/5] overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Image
          src={artwork.thumbnailUrl}
          alt={artwork.title}
          fill
          sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          className="object-cover transition-transform duration-500 ease-out hover:scale-[1.04]"
        />
        {artwork.insured && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full border border-gold/40 bg-background/90 px-2 py-1 text-[11px] font-medium text-gold-bright backdrop-blur-sm">
            <ShieldCheck className="size-3" strokeWidth={2} />
            Insured
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <Link
          href={`/marketplace/${artwork.id}`}
          target="_blank"
          className="line-clamp-2 font-display text-sm leading-snug font-semibold text-foreground hover:text-gold-bright"
        >
          {artwork.title}
        </Link>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{artwork.artistName}</span>
          {artwork.verifiedArtist && (
            <VerifiedBadge verification={MINIMUM_VERIFICATION} size="sm" />
          )}
        </div>
        <PriceTag amount={artwork.customerPrice} className="mt-1 text-base" />

        <Button onClick={onReserve} className="mt-2.5 w-full">
          Reserve
        </Button>
      </div>
    </div>
  );
}
