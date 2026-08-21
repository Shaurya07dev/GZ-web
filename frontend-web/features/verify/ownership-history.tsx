"use client";

import { ArrowRight, Clock3 } from "lucide-react";
import { useArtworkTransfers } from "@/hooks/useOwnershipTransfers";

// The chain of hand-overs, oldest last. Every accepted transfer stays here
// permanently — a resale adds a link, it never replaces the previous one.
export function OwnershipHistory({
  artworkId,
  artistName,
}: {
  artworkId: string;
  artistName: string;
}) {
  const { data: transfers } = useArtworkTransfers(artworkId);
  const visible = (transfers ?? []).filter((t) => t.status !== "cancelled");

  if (visible.length === 0) return null;

  return (
    <div className="mx-auto mt-14 max-w-md">
      <h2 className="font-display text-sm font-semibold tracking-wide text-foreground uppercase">
        Ownership history
      </h2>
      <ol className="mt-4 flex flex-col gap-2">
        {visible.map((transfer) => (
          <li
            key={transfer.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-card px-4 py-3 text-sm"
          >
            <span className="text-muted-foreground">{transfer.fromName}</span>
            <ArrowRight
              className="size-3.5 shrink-0 text-gold-bright"
              strokeWidth={2}
            />
            <span className="font-medium text-foreground">
              {transfer.toName}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {transfer.status === "pending" ? (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3" strokeWidth={2} />
                  Awaiting acceptance
                </span>
              ) : (
                formatDate(transfer.acceptedAt ?? transfer.initiatedAt)
              )}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Created by {artistName}. Each hand-over is recorded when the new owner
        accepts it, and stays on this passport for the artwork&rsquo;s life.
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
