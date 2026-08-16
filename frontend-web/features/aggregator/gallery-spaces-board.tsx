"use client";

import { Building2, MapPin, UserRound, PackageCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { holdingsCol } from "@/lib/mock-collections";
import { useAggregatorGallerySpaces } from "@/hooks/useAggregatorGallerySpaces";

// The aggregator's OWN physical premises/display locations — not to be
// confused with the Artist Dashboard's "Gallery Spaces" page, which lists
// an artist's artworks currently sitting at an aggregator. Same label,
// opposite direction, different actor.
export function GallerySpacesBoard() {
  const { data: spaces, isPending } = useAggregatorGallerySpaces();
  // Occupancy = currently reserved holdings (there is only one premises
  // concept modeled today, so every active holding counts against it).
  const occupancy = holdingsCol
    .get()
    .filter((h) => h.status === "reserved").length;

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!spaces || spaces.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No gallery spaces on file"
        description="Your display premises will appear here once registered with GalleryZone."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {spaces.map((space) => {
        const pct = Math.min(
          100,
          Math.round((occupancy / space.capacity) * 100),
        );
        return (
          <div
            key={space.id}
            className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-background">
                <Building2 className="size-4 text-gold-bright" strokeWidth={1.5} />
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-display text-base font-semibold text-foreground">
                  {space.name}
                </h2>
                <p className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 size-3 shrink-0" />
                  {space.addressLine1}, {space.city}, {space.state}{" "}
                  {space.pincode}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserRound className="size-3.5 text-muted-foreground" />
              Coordinator: {space.coordinatorName}
            </div>

            <div className="mt-auto flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <PackageCheck className="size-3.5" />
                  Occupancy
                </span>
                <span className="tabular-nums text-foreground">
                  {occupancy} / {space.capacity}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gold-bright"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
