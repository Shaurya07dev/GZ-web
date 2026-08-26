"use client";

import { useMemo } from "react";
import {
  FileEdit,
  ScanLine,
  UserRoundCheck,
  Printer,
  PackageCheck,
  Award,
  Clock3,
  Building2,
  Truck,
  Undo2,
  CalendarClock,
} from "lucide-react";
import type { Artwork, OwnershipTransfer } from "@/types/artwork";
import { isDisplayActive, transferKind } from "@/types/artwork";
import { useArtworkTransfers } from "@/hooks/useOwnershipTransfers";
import { useArtworkCoaRequests } from "@/hooks/usePhysicalCoa";

// Two histories, not one merged stream.
//
// A certificate answers two different questions and they are not the same
// question: WHO OWNS THIS, and WHO IS ALLOWED TO SHOW IT. A piece can be owned
// by a collector in Chennai and hanging in a gallery in Pune, and the old
// single timeline interleaved those two stories so tightly that neither could
// be read — a "Returned to the artist" row sat between two ownership transfers
// as if it were one.
//
// Ownership moves permanently and only on acceptance. Display rights are loans:
// they expire on a date, they never change the owner, and the piece coming back
// is the normal end of one, not an incident.

type HistoryEvent = {
  at: string;
  icon: typeof FileEdit;
  label: string;
  detail?: string;
};

// Which side of the certificate each status belongs to. Splitting by status is
// only honest because the two paths don't share one: a piece heading to an
// aggregator goes reserved -> preparing_dispatch -> in_transit ->
// with_aggregator, and a piece that has been bought goes sold -> delivered ->
// completed. Anything new has to be classified here deliberately, which is why
// this is an explicit map rather than a list of exceptions.
const OWNERSHIP_STATUS: Record<string, string> = {
  draft: "Listing created by the artist",
  pending_approval: "Submitted to GalleryZone for review",
  marketplace: "Approved and listed for sale",
  sold: "Sold",
  settlement_complete: "Settlement completed",
  delivered: "Delivered to the buyer",
  completed: "Sale completed",
  sold_externally: "Sold outside GalleryZone",
};

const DISPLAY_STATUS: Record<string, string> = {
  reserved: "Reserved for aggregator display",
  preparing_dispatch: "Being prepared for dispatch",
  in_transit: "In transit to the display space",
  with_aggregator: "On display with an aggregator",
  returned: "Came back from display",
};

const DISPLAY_STATUS_ICON: Record<string, typeof FileEdit> = {
  reserved: Clock3,
  preparing_dispatch: PackageCheck,
  in_transit: Truck,
  with_aggregator: Building2,
  returned: Undo2,
};

export function ArtworkHistory({ artwork }: { artwork: Artwork }) {
  const { data: transfers } = useArtworkTransfers(artwork.id);
  const { data: coaRequests } = useArtworkCoaRequests(artwork.id);

  const { ownership, display } = useMemo(() => {
    const ownership: HistoryEvent[] = [];
    const display: HistoryEvent[] = [];

    for (const event of artwork.statusHistory) {
      if (OWNERSHIP_STATUS[event.status]) {
        ownership.push({
          at: event.changedAt,
          icon: FileEdit,
          label: OWNERSHIP_STATUS[event.status],
        });
      } else if (DISPLAY_STATUS[event.status]) {
        display.push({
          at: event.changedAt,
          icon: DISPLAY_STATUS_ICON[event.status] ?? Building2,
          label: DISPLAY_STATUS[event.status],
        });
      }
    }

    // The certificate and the tag are ownership facts: they are what proves who
    // holds the piece, and they travel with it when it changes hands.
    ownership.push({
      at: artwork.coaIssueDate,
      icon: Award,
      label: "Certificate of Authenticity issued",
      detail: artwork.coaCertificateNumber,
    });

    // There is no timestamp for tagging in the mock data — the tag is either
    // attached or it isn't — so it is pinned to the certificate's date rather
    // than inventing one.
    if (artwork.nfcTagId) {
      ownership.push({
        at: artwork.coaIssueDate,
        icon: ScanLine,
        label: "NFC / QR tag linked",
        detail: artwork.nfcTagId,
      });
    }

    for (const transfer of transfers ?? []) {
      if (transfer.status === "cancelled") continue;
      if (transferKind(transfer) === "display") {
        display.push(displayEvent(transfer));
      } else {
        ownership.push({
          at: transfer.acceptedAt ?? transfer.initiatedAt,
          icon: transfer.status === "accepted" ? UserRoundCheck : Clock3,
          label:
            transfer.status === "accepted"
              ? `Ownership transferred to ${transfer.toName}`
              : `Transfer to ${transfer.toName} awaiting acceptance`,
          detail: `From ${transfer.fromName}`,
        });
      }
    }

    for (const request of coaRequests ?? []) {
      ownership.push({
        at: request.requestedAt,
        icon: Printer,
        label: "Paper certificate requested",
        detail: `By ${request.requestedByName}`,
      });
      if (request.status === "dispatched" && request.dispatchedAt) {
        ownership.push({
          at: request.dispatchedAt,
          icon: PackageCheck,
          label: "Signed paper certificate dispatched",
          detail: request.courierRef ?? undefined,
        });
      }
    }

    const newestFirst = (a: HistoryEvent, b: HistoryEvent) =>
      b.at.localeCompare(a.at);
    return {
      ownership: ownership.sort(newestFirst),
      display: display.sort(newestFirst),
    };
  }, [artwork, transfers, coaRequests]);

  if (ownership.length === 0 && display.length === 0) return null;

  return (
    <div className="flex flex-col gap-5 border-t border-border pt-4">
      <Timeline
        title="Ownership"
        caption="Who owns this piece. Every hand-over is recorded when the other side accepts it."
        events={ownership}
        emptyText="Nothing recorded yet."
      />
      <Timeline
        title="Display rights"
        caption="Who has been allowed to show it. A loan never changes the owner."
        events={display}
        emptyText="This piece has never been out on display."
      />
    </div>
  );
}

function displayEvent(transfer: OwnershipTransfer): HistoryEvent {
  if (transfer.status === "pending") {
    return {
      at: transfer.initiatedAt,
      icon: Clock3,
      label: `Display rights offered to ${transfer.toName}`,
      detail: "Awaiting acceptance",
    };
  }

  const at = transfer.acceptedAt ?? transfer.initiatedAt;

  // A loan that has run its course reads differently from one still running,
  // and "ended early" is a different fact again — the owner pulled it back.
  if (isDisplayActive(transfer)) {
    return {
      at,
      icon: CalendarClock,
      label: `On display with ${transfer.toName}`,
      detail: transfer.displayEndsAt
        ? `Until ${formatDate(transfer.displayEndsAt)}`
        : undefined,
    };
  }

  const endedOn = transfer.displayEndedAt ?? transfer.displayEndsAt;
  return {
    at,
    icon: Undo2,
    label: `Display with ${transfer.toName} ended`,
    detail: endedOn
      ? `${transfer.displayEndedAt ? "Ended early" : "Ran to"} ${formatDate(endedOn)}`
      : undefined,
  };
}

function Timeline({
  title,
  caption,
  events,
  emptyText,
}: {
  title: string;
  caption: string;
  events: HistoryEvent[];
  emptyText: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <p className="-mt-1 text-xs leading-relaxed text-muted-foreground">
        {caption}
      </p>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ol className="mt-1 flex flex-col">
          {events.map((event, i) => (
            <li key={`${event.at}-${event.label}-${i}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                  <event.icon
                    className="size-3 text-gold-bright"
                    strokeWidth={1.75}
                  />
                </span>
                {i < events.length - 1 && (
                  <span className="w-px flex-1 bg-border" aria-hidden="true" />
                )}
              </div>
              <div className="pb-3">
                <p className="text-sm text-foreground">{event.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(event.at)}
                  {event.detail ? ` · ${event.detail}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
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
