"use client";

import Image from "next/image";
import { BookmarkCheck, CircleCheckBig, GalleryVerticalEnd } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PriceTag } from "@/components/shared/price-tag";
import { ExpiryCountdown } from "@/features/aggregator/expiry-countdown";
import { useArtistGallerySpaces } from "@/hooks/useArtistGallerySpaces";
import type { AggregatorHolding } from "@/types/aggregator";

const STATUS_CONFIG: Record<
  AggregatorHolding["status"],
  { label: string; icon: typeof BookmarkCheck; className: string }
> = {
  reserved: {
    label: "With gallery",
    icon: BookmarkCheck,
    className: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  sold_pending_settlement: {
    label: "Sold, pending settlement",
    icon: CircleCheckBig,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
};

export function GallerySpacesTable() {
  const { data, isPending, isError } = useArtistGallerySpaces();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Gallery spaces
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Pieces currently placed with an aggregator for physical display,
          for up to 30 days.
        </p>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={GalleryVerticalEnd}
          title="Couldn't load your gallery spaces"
          description="Something went wrong. Try refreshing the page."
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={GalleryVerticalEnd}
          title="No pieces with a gallery yet"
          description="Artworks listed for marketplace + aggregator distribution will show up here once a gallery reserves one."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground uppercase">
                <th className="px-4 py-3 font-medium">Artwork</th>
                <th className="px-4 py-3 font-medium">Display price</th>
                <th className="px-4 py-3 font-medium">Window</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((holding) => {
                const isSold = holding.status === "sold_pending_settlement";
                const status = STATUS_CONFIG[holding.status];
                return (
                  <tr
                    key={holding.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                          <Image
                            src={holding.artwork.thumbnailUrl}
                            alt={holding.artwork.title}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </div>
                        <p className="truncate font-medium text-foreground">
                          {holding.artwork.title}
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <PriceTag amount={holding.displayPrice} className="text-sm" />
                    </td>

                    <td className="px-4 py-3.5">
                      {isSold ? (
                        <span className="text-xs text-muted-foreground">
                          &mdash;
                        </span>
                      ) : (
                        <ExpiryCountdown
                          expiresAt={holding.expiresAt}
                          className="w-32"
                        />
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${status.className}`}
                      >
                        <status.icon className="size-3" strokeWidth={2} />
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
