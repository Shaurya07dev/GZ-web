"use client";

import { useSyncExternalStore } from "react";
import { Clock3, Frame } from "lucide-react";
import {
  useArtworkTransfers,
  useEndDisplayMutation,
} from "@/hooks/useOwnershipTransfers";
import { readSessionRole, subscribeToSession } from "@/lib/session";
import { activeDisplayTransfer, transferKind } from "@/types/artwork";

// What is happening to the piece right now that the provenance record cannot say yet.
//
// Every hand-over that has been accepted (sales, gifts, display loans) is already a step in the provenance thread
// (lifecycle-timeline.tsx), so repeating the settled ones here only showed the same history twice. This keeps the
// two things the thread does not carry: a display loan that is running, with its dates, and hand-overs still
// waiting for the other side to accept (a hand-over that was never accepted did not happen, so the thread leaves
// it out).
//
// Display rights are loans, not sales: they never change the owner, and end on their date without anything
// having to run to end them.
export function OwnershipHistory({
  artworkId,
}: {
  artworkId: string;
  /** Kept so older callers still compile; the artist is already the first step of the provenance thread. */
  artistName?: string;
}) {
  const { data: transfers } = useArtworkTransfers(artworkId);
  const endDisplay = useEndDisplayMutation();

  // The passport is public. Ending a display early is the owner's call, so the control only appears for someone
  // signed in. There is no real auth behind any of this yet.
  const sessionRole = useSyncExternalStore(
    subscribeToSession,
    readSessionRole,
    () => null,
  );

  const open = (transfers ?? []).filter((t) => t.status !== "cancelled");
  const onDisplay = activeDisplayTransfer(open);
  const pending = open.filter((t) => t.status === "pending" && t.id !== onDisplay?.id);
  if (!onDisplay && pending.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      {onDisplay && (
        <div>
          <p className="flex items-center gap-2.5 text-base font-medium text-foreground">
            <Frame className="size-4 shrink-0 text-gold-bright" strokeWidth={1.75} />
            On display with {onDisplay.toName}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-passport-ink-2">
            {formatDate(onDisplay.displayStartsAt ?? onDisplay.acceptedAt ?? onDisplay.initiatedAt)} to{" "}
            {formatDate(onDisplay.displayEndsAt!)}. Ownership is unchanged, and the loan ends on that date by itself.
          </p>
          {sessionRole && (
            <button
              type="button"
              disabled={endDisplay.isPending}
              onClick={() => endDisplay.mutate(onDisplay.id)}
              className="mt-3 min-h-11 rounded-full border border-gold/50 px-5 text-sm font-medium whitespace-nowrap text-gold-bright transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-gold hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:scale-[0.98] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-40"
            >
              End display now
            </button>
          )}
          {endDisplay.error instanceof Error && (
            <p className="mt-2 text-sm text-destructive">{endDisplay.error.message}</p>
          )}
        </div>
      )}

      {pending.map((transfer) => (
        <p key={transfer.id} className="flex items-start gap-2.5 text-sm leading-relaxed text-passport-ink-2">
          <Clock3 className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <span>
            <span className="font-medium text-foreground">{transfer.toName}</span>{" "}
            {transferKind(transfer) === "display" ? "has been asked by" : "has been offered this piece by"} {transfer.fromName}
            {transferKind(transfer) === "display" ? " to show this piece and has not accepted yet." : " and has not accepted yet."}
          </span>
        </p>
      ))}
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
