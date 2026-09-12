import Link from "next/link";
import { BookmarkCheck, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockAggregatorHoldings } from "@/lib/mock-data/aggregator-holdings";
import { getArtworkById } from "@/lib/mock-data/helpers";
import { formatINR } from "@/lib/utils";
import { MOCK_TODAY } from "./aggregator-data";

// A fork of features/dashboard/recent-activity-feed.tsx's visual pattern
// (adapt, don't import -- see aggregator-shell.tsx's identical reasoning),
// sourced directly from the seeded mockAggregatorHoldings fixture rather
// than the live useAggregatorCollection() query. This is a deliberate
// choice, not an oversight: like the artist dashboard's own ACTIVITY_FEED,
// this reads as a "how you got here" history rail, not a live event log --
// mirroring the plan's Task 22 spec ("recent-activity list ... from
// mockAggregatorHoldings"). A session's own reserve/sale actions still show
// up correctly in the KPI cards and Collection table (both backed by the
// live query), just not retroactively rewritten into this seeded history.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function relativeTime(iso: string): string {
  const days = Math.round(
    (MOCK_TODAY.getTime() - new Date(iso).getTime()) / ONE_DAY_MS,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

const activityItems = mockAggregatorHoldings
  .map((holding) => {
    const artwork = getArtworkById(holding.artworkId);
    if (!artwork) return null;
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

export function AggregatorActivityFeed() {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-base font-semibold text-foreground">
        Recent activity
      </h2>

      {activityItems.length === 0 ? (
        <div className="mt-4 flex flex-col items-start gap-4">
          <p className="text-sm text-muted-foreground">
            No activity yet. Reserve an artwork from Inventory to get started.
          </p>
          <Button render={<Link href="/aggregator/inventory" />} variant="outline" size="sm">
            Browse Inventory
          </Button>
        </div>
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
