"use client";

import { useSyncExternalStore } from "react";
import { ArrowRight, Clock3, Frame } from "lucide-react";
import {
  useArtworkTransfers,
  useEndDisplayMutation,
} from "@/hooks/useOwnershipTransfers";
import { readSessionRole, subscribeToSession } from "@/lib/session";
import {
  activeDisplayTransfer,
  isDisplayActive,
  transferKind,
  type OwnershipTransfer,
} from "@/types/artwork";

// The chain of hand-overs, oldest last. Every accepted transfer stays here
// permanently — a resale adds a link, it never replaces the previous one.
//
// Display rights sit in the same list because they are the same event to a
// reader of the passport: the piece went somewhere. They are marked as loans
// rather than sales, and a display that has run past its date reads as ended
// without anything having to run to end it.
export function OwnershipHistory({
  artworkId,
  artistName,
}: {
  artworkId: string;
  artistName: string;
}) {
  const { data: transfers } = useArtworkTransfers(artworkId);
  const endDisplay = useEndDisplayMutation();

  // The passport is public. Ending a display early is the owner's call, so the
  // control only appears for someone signed in — the same treatment the artist
  // connect button gets. There is no real auth behind any of this yet.
  const sessionRole = useSyncExternalStore(
    subscribeToSession,
    readSessionRole,
    () => null,
  );

  const visible = (transfers ?? []).filter((t) => t.status !== "cancelled");
  if (visible.length === 0) return null;

  const onDisplay = activeDisplayTransfer(visible);

  return (
    <div className="mx-auto mt-14 max-w-md">
      <h2 className="font-display text-sm font-semibold tracking-wide text-foreground uppercase">
        Ownership history
      </h2>

      {onDisplay && (
        <div className="mt-4 rounded-lg border border-gold/40 bg-gold/5 p-4">
          <div className="flex items-center gap-2">
            <Frame className="size-4 shrink-0 text-gold-bright" strokeWidth={1.75} />
            <p className="text-sm font-medium text-foreground">
              On display with {onDisplay.toName}
            </p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Until {formatDate(onDisplay.displayEndsAt!)}. Ownership is unchanged
            — display rights end on that date on their own.
          </p>
          {sessionRole && (
            <button
              type="button"
              disabled={endDisplay.isPending}
              onClick={() => endDisplay.mutate(onDisplay.id)}
              className="mt-3 rounded-md border border-gold/50 px-3.5 py-2 text-xs font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10 disabled:pointer-events-none disabled:opacity-40"
            >
              End display now
            </button>
          )}
          {endDisplay.error instanceof Error && (
            <p className="mt-2 text-xs text-destructive">
              {endDisplay.error.message}
            </p>
          )}
        </div>
      )}

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
            {transferKind(transfer) === "display" && (
              <span className="rounded-full border border-gold/40 px-2 py-0.5 text-[11px] font-medium text-gold-bright">
                Display
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {statusLabel(transfer)}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Created by {artistName}. Each hand-over is recorded when the other side
        accepts it, and stays on this passport for the artwork&rsquo;s life.
        Display rights are loans, not sales — they never change the owner.
      </p>
    </div>
  );
}

function statusLabel(transfer: OwnershipTransfer): React.ReactNode {
  if (transfer.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1">
        <Clock3 className="size-3" strokeWidth={2} />
        Awaiting acceptance
      </span>
    );
  }

  if (transferKind(transfer) === "display") {
    if (isDisplayActive(transfer)) {
      return `Until ${formatDate(transfer.displayEndsAt!)}`;
    }
    const endedOn = transfer.displayEndedAt ?? transfer.displayEndsAt;
    return endedOn ? `Display ended ${formatDate(endedOn)}` : "Display ended";
  }

  return formatDate(transfer.acceptedAt ?? transfer.initiatedAt);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
