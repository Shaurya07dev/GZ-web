"use client";

import Image from "next/image";
import { useAggregatorCollection } from "@/hooks/useAggregatorCollection";
import { useReservableInventory } from "@/hooks/useAggregatorInventory";
import { PriceTag } from "@/components/shared/price-tag";
import type { AggregatorHolding } from "@/types/aggregator";
import type { ArtworkSummary } from "@/types/artwork";
import Link from "next/link";
import { BookmarkCheck, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";


// Recent activity is derived from the live holdings: the newest five
// reservations and sales, no stored feed.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function relativeTime(iso: string): string {
  const days = Math.round(
    (Date.now() - new Date(iso).getTime()) / ONE_DAY_MS,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function activityItemsFrom(holdings: Array<AggregatorHolding & { artwork: ArtworkSummary }>) {
  return holdings
  .map((holding) => {
    const artwork = holding.artwork;
    const sold = holding.status === "sold_pending_settlement";
    return {
      id: holding.id,
      icon: sold ? Banknote : BookmarkCheck,
      title: sold
        ? `Sale recorded: "${artwork.title}"`
        : `Reserved: "${artwork.title}"`,
      detail: `Display price ${formatINR(holding.displayPrice)} · ${holding.advancePercent}% advance`,
      time: relativeTime(holding.assignedAt),
      sortKey: holding.assignedAt,
    };
  })
  .filter((item): item is NonNullable<typeof item> => item !== null)
  .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
  .slice(0, 5);
}

// Before the first reservation there is no activity to show, so the card shows where to start: the pieces
// most recently opened for reservation (the API sends newest first).
function NewestToReserve() {
  const { data } = useReservableInventory();
  const pieces = (data ?? []).slice(0, 4);
  return (
    <div className="mt-4 flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        No activity yet. These are the newest pieces you can reserve.
      </p>
      {pieces.length > 0 && (
        <ul className="grid grid-cols-2 gap-4">
          {pieces.map((artwork) => (
            <li key={artwork.id} className="min-w-0">
              <Link
                href={`/aggregator/inventory/${artwork.id}/reserve`}
                className="group flex flex-col gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="relative block aspect-[4/5] overflow-hidden rounded-md border border-border bg-muted">
                  <Image
                    src={artwork.thumbnailUrl}
                    alt={artwork.title}
                    fill
                    sizes="(min-width: 1024px) 18vw, 45vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </span>
                <span className="line-clamp-1 text-sm font-medium text-foreground group-hover:text-gold-bright">{artwork.title}</span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{artwork.artistName}</span>
                <PriceTag amount={artwork.offer.offerPrice} className="text-sm" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Button nativeButton={false} render={<Link href="/aggregator/inventory" />} variant="outline" size="sm" className="w-fit">
        Browse Inventory
      </Button>
    </div>
  );
}

export function AggregatorActivityFeed() {
  const { data: holdings } = useAggregatorCollection();
  const activityItems = activityItemsFrom(holdings ?? []);
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-base font-semibold text-foreground">
        Recent activity
      </h2>

      {activityItems.length === 0 ? (
        <NewestToReserve />
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {activityItems.map((item) => (
            <li key={item.id} className="flex items-start gap-3.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-background">
                <item.icon
                  className="size-4 text-gold-bright"
                  strokeWidth={1.5}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.detail}
                </p>
              </div>
              <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                {item.time}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
