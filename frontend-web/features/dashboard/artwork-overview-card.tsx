"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useArtistDashboardArtworks } from "@/hooks/useArtistArtworks";
import type { ArtworkStatus } from "@/types/artwork";

const LIVE_STATUSES: ArtworkStatus[] = [
  "marketplace",
  "reserved",
  "with_aggregator",
];
const SOLD_STATUSES: ArtworkStatus[] = [
  "sold",
  "settlement_complete",
  "delivered",
  "completed",
  "sold_externally",
];
const IN_PROGRESS_STATUSES: ArtworkStatus[] = [
  "preparing_dispatch",
  "in_transit",
  "returned",
];

export function ArtworkOverviewCard() {
  const { data: artworks } = useArtistDashboardArtworks();
  const total = artworks?.length ?? 0;

  const rows = [
    {
      label: "Live",
      count: artworks?.filter((a) => LIVE_STATUSES.includes(a.status)).length ?? 0,
    },
    {
      label: "Under review",
      count: artworks?.filter((a) => a.status === "pending_approval").length ?? 0,
    },
    {
      label: "Draft",
      count: artworks?.filter((a) => a.status === "draft").length ?? 0,
    },
    {
      label: "In transit",
      count:
        artworks?.filter((a) => IN_PROGRESS_STATUSES.includes(a.status))
          .length ?? 0,
    },
    {
      label: "Sold",
      count: artworks?.filter((a) => SOLD_STATUSES.includes(a.status)).length ?? 0,
    },
  ].filter((row) => row.count > 0);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold text-foreground">
          Your artworks
        </h2>
        <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
          {total}
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium tabular-nums text-foreground">
              {row.count}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href="/dashboard/artworks"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gold-bright hover:underline"
      >
        View all artworks
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
