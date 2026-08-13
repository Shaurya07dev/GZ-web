import { Check } from "lucide-react";
import type { ArtworkStatus, ArtworkStatusEvent } from "@/types/artwork";

const STATUS_LABEL: Record<ArtworkStatus, string> = {
  draft: "Listing created",
  pending_approval: "Submitted for review",
  marketplace: "Listed on the marketplace",
  reserved: "Reserved by an aggregator",
  preparing_dispatch: "Preparing for dispatch",
  in_transit: "In transit",
  with_aggregator: "In aggregator display",
  sold: "Sold",
  settlement_complete: "Settlement complete",
  delivered: "Delivered",
  completed: "Sale completed",
  returned: "Returned",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

interface ProvenanceTimelineProps {
  history: ArtworkStatusEvent[];
}

// Renders artwork.statusHistory oldest-first as a vertical timeline (Task 17
// Step 2) — the append-only ownership/provenance record behind the
// certificate, sourced straight from artwork_status_history per the spec.
export function ProvenanceTimeline({ history }: ProvenanceTimelineProps) {
  const ordered = [...history].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
  );

  if (ordered.length === 0) return null;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground">
        Provenance
      </h2>
      <ol className="mt-5 flex flex-col">
        {ordered.map((event, index) => {
          const isLast = index === ordered.length - 1;
          return (
            <li
              key={`${event.status}-${event.changedAt}`}
              className="relative flex gap-4 pb-7 last:pb-0"
            >
              {!isLast && (
                <span
                  className="absolute top-6 left-[11px] h-full w-px bg-border"
                  aria-hidden="true"
                />
              )}
              <span
                className="relative z-10 flex size-[23px] shrink-0 items-center justify-center rounded-full border border-gold/40 bg-card"
                aria-hidden="true"
              >
                <Check className="size-3 text-gold-bright" strokeWidth={2.5} />
              </span>
              <div className="pt-0.5">
                <p className="text-sm font-medium text-foreground">
                  {STATUS_LABEL[event.status]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(event.changedAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
