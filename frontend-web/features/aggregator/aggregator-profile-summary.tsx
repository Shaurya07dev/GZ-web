"use client";

import {
  Building2,
  CircleCheckBig,
  FileSignature,
  Frame,
  Landmark,
  MapPin,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/utils";
import { useAggregatorStats } from "@/hooks/useProfileStats";
import { useAggregatorProfile } from "@/hooks/useAggregatorProfile";

// The partner business at a glance: what they are holding, what they have
// sold, and what they owe.
//
// The last of those is the reason this card leads with obligations rather than
// earnings. An aggregator collects on GalleryZone's behalf; money in their
// till is not income, and a summary that mixed the two would invite exactly
// the netting-off the MOU forbids.

function signedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AggregatorProfileSummary() {
  const { data: stats, isPending } = useAggregatorStats();
  const { data: profile } = useAggregatorProfile();

  if (isPending || !stats) {
    return <Skeleton className="h-56 w-full rounded-lg" />;
  }

  const cells = [
    { key: "display", label: "On display now", value: String(stats.onDisplay), icon: Frame },
    { key: "sold", label: "Pieces sold", value: String(stats.piecesSold), icon: CircleCheckBig },
    { key: "buyers", label: "Buyers", value: String(stats.distinctBuyers), icon: Users },
    {
      key: "capacity",
      label: "Display capacity",
      value: `${stats.onDisplay} / ${stats.displayCapacity}`,
      icon: Building2,
    },
    {
      key: "commission",
      label: "Commission earned",
      value: formatINR(stats.commissionEarned),
      icon: Landmark,
    },
    {
      key: "held",
      label: "Held against reservations",
      value: formatINR(stats.heldAgainstReservations),
      icon: Landmark,
    },
  ];

  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            {profile?.companyName ?? "Your gallery"}
          </h2>
          {stats.cities.length > 0 && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5" strokeWidth={1.75} />
              {stats.cities.join(" · ")} ·{" "}
              {stats.gallerySpaces === 1
                ? "1 space"
                : `${stats.gallerySpaces} spaces`}
            </p>
          )}
        </div>

        <span
          className={
            stats.mouSignedAt
              ? "flex items-center gap-1.5 rounded-full border border-gold/40 px-3 py-1 text-xs text-gold-bright"
              : "flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
          }
        >
          <FileSignature className="size-3.5" strokeWidth={1.75} />
          {stats.mouSignedAt
            ? `MOU signed ${signedLabel(stats.mouSignedAt)}`
            : "MOU not signed"}
        </span>
      </div>

      {/* An obligation, not an entitlement — so it sits apart from the grid
          below rather than reading as another figure they have earned. */}
      {stats.owedToGalleryZone > 0 && (
        <p className="mt-4 rounded-md border border-gold/30 bg-gold/5 px-3.5 py-2.5 text-sm leading-relaxed text-gold-bright">
          {formatINR(stats.owedToGalleryZone)} collected in cash is owed to
          GalleryZone. Transfer the full amount — your commission is settled
          separately.
        </p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cells.map((cell) => (
          <div key={cell.key} className="flex flex-col gap-1">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <cell.icon className="size-3.5" strokeWidth={1.75} />
              {cell.label}
            </dt>
            <dd className="font-display text-xl font-semibold tabular-nums text-foreground">
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>

      {stats.returned > 0 && (
        <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
          {stats.returned}{" "}
          {stats.returned === 1 ? "piece has" : "pieces have"} gone back to
          GalleryZone unsold.
        </p>
      )}
    </section>
  );
}
