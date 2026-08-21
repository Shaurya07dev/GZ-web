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
} from "lucide-react";
import type { Artwork } from "@/types/artwork";
import { useArtworkTransfers } from "@/hooks/useOwnershipTransfers";
import { useArtworkCoaRequests } from "@/hooks/usePhysicalCoa";

// One history per artwork, keyed to its certificate and tag. The events live
// in three separate places — the artwork's own status history, the ownership
// transfer chain, and paper-COA fulfilment — and a person looking at a
// certificate wants them as a single story, newest first.

type HistoryEvent = {
  at: string;
  icon: typeof FileEdit;
  label: string;
  detail?: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Listing created",
  pending_approval: "Submitted for review",
  marketplace: "Approved and listed",
  reserved: "Reserved by an aggregator",
  preparing_dispatch: "Preparing for dispatch",
  in_transit: "In transit",
  with_aggregator: "On display with an aggregator",
  sold: "Sold",
  settlement_complete: "Settlement completed",
  delivered: "Delivered to the buyer",
  completed: "Sale completed",
  returned: "Returned to the artist",
  sold_externally: "Sold outside GalleryZone",
};

export function ArtworkHistory({ artwork }: { artwork: Artwork }) {
  const { data: transfers } = useArtworkTransfers(artwork.id);
  const { data: coaRequests } = useArtworkCoaRequests(artwork.id);

  const events = useMemo<HistoryEvent[]>(() => {
    const list: HistoryEvent[] = artwork.statusHistory.map((event) => ({
      at: event.changedAt,
      icon: FileEdit,
      label: STATUS_LABEL[event.status] ?? event.status,
    }));

    // The certificate itself is an event: it is what this screen is about.
    list.push({
      at: artwork.coaIssueDate,
      icon: Award,
      label: "Certificate of Authenticity issued",
      detail: artwork.coaCertificateNumber,
    });

    // There is no timestamp for tagging in the mock data — the tag is either
    // attached or it isn't — so it is pinned to the certificate's date rather
    // than inventing one.
    if (artwork.nfcTagId) {
      list.push({
        at: artwork.coaIssueDate,
        icon: ScanLine,
        label: "NFC / QR tag linked",
        detail: artwork.nfcTagId,
      });
    }

    for (const transfer of transfers ?? []) {
      if (transfer.status === "cancelled") continue;
      list.push({
        at: transfer.acceptedAt ?? transfer.initiatedAt,
        icon: transfer.status === "accepted" ? UserRoundCheck : Clock3,
        label:
          transfer.status === "accepted"
            ? `Ownership transferred to ${transfer.toName}`
            : `Transfer to ${transfer.toName} awaiting acceptance`,
        detail: `From ${transfer.fromName}`,
      });
    }

    for (const request of coaRequests ?? []) {
      list.push({
        at: request.requestedAt,
        icon: Printer,
        label: "Paper certificate requested",
        detail: `By ${request.requestedByName}`,
      });
      if (request.status === "dispatched" && request.dispatchedAt) {
        list.push({
          at: request.dispatchedAt,
          icon: PackageCheck,
          label: "Signed paper certificate dispatched",
          detail: request.courierRef ?? undefined,
        });
      }
    }

    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [artwork, transfers, coaRequests]);

  if (events.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        History
      </p>
      <ol className="flex flex-col">
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
