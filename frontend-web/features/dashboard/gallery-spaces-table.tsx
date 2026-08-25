"use client";

import Image from "next/image";
import {
  BookmarkCheck,
  CircleCheckBig,
  Undo2,
  GalleryVerticalEnd,
  CalendarRange,
  MapPin,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PriceTag } from "@/components/shared/price-tag";
import { ExpiryCountdown } from "@/features/aggregator/expiry-countdown";
import { useArtistGallerySpaces } from "@/hooks/useArtistGallerySpaces";
import type { AggregatorHolding } from "@/types/aggregator";
import { AGGREGATOR } from "@/features/aggregator/aggregator-data";

const STATUS_CONFIG: Record<
  AggregatorHolding["status"],
  { label: string; icon: typeof BookmarkCheck; className: string }
> = {
  reserved: {
    label: "With aggregator",
    icon: BookmarkCheck,
    className: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  sold_pending_settlement: {
    label: "Sold, pending settlement",
    icon: CircleCheckBig,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  returned: {
    label: "Returned",
    icon: Undo2,
    className: "border-border bg-muted/40 text-muted-foreground",
  },
};

export function GallerySpacesTable() {
  const { data, isPending, isError } = useArtistGallerySpaces();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Aggregator display
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Where your work is physically on display right now.
          </p>
        </div>

        {/* Your artwork is with GalleryZone for a six-month listing period —
            not a fixed month-per-location schedule. Locations can change
            within that period; this page always shows the current one. */}
        <div className="flex items-start gap-3 rounded-lg border border-gold/25 bg-gold/5 p-4">
          <CalendarRange
            className="mt-0.5 size-4 shrink-0 text-gold-bright"
            strokeWidth={1.75}
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            You send your artwork for a{" "}
            <span className="font-medium text-foreground">
              six-month listing period
            </span>
            . Within it, GalleryZone places the piece with an aggregator for
            display and may move it to another one if it hasn&rsquo;t sold —
            you don&rsquo;t commit to a location for a fixed month. Whatever
            the current placement is, it shows here.
          </p>
        </div>
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
          title="Couldn't load your aggregator display"
          description="Something went wrong. Try refreshing the page."
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={GalleryVerticalEnd}
          title="No pieces with an aggregator yet"
          description="Artworks listed on the aggregator channel show up here once an aggregator reserves one."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground uppercase">
                <th className="px-4 py-3 font-medium">Artwork</th>
                <th className="px-4 py-3 font-medium">Display price</th>
                <th className="px-4 py-3 font-medium">Current location</th>
                <th className="px-4 py-3 font-medium">At this location until</th>
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
                      <div className="flex items-center gap-2">
                        <MapPin
                          className="size-3.5 shrink-0 text-muted-foreground"
                          strokeWidth={1.75}
                        />
                        <span className="text-foreground">
                          {AGGREGATOR.companyName}
                        </span>
                      </div>
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
