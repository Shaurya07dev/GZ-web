import { Package, Truck, PackageCheck, PackageSearch } from "lucide-react";
import { cn } from "@/lib/utils";

export type ShipmentStage =
  | "pickup"
  | "in_transit"
  | "out_for_delivery"
  | "delivered";

const STAGES: readonly {
  key: ShipmentStage;
  label: string;
  icon: typeof Package;
}[] = [
  { key: "pickup", label: "Pickup", icon: PackageSearch },
  { key: "in_transit", label: "In transit", icon: Truck },
  { key: "out_for_delivery", label: "Out for delivery", icon: Package },
  { key: "delivered", label: "Delivered", icon: PackageCheck },
];

// A four-step progress strip + current-stage pill, driven by whatever
// ShipRocket last pushed. Shared by the artist's artwork-history, the
// aggregator's inbound/outbound shipping tables, and the customer's order
// page — any surface showing a parcel in flight.
export function ShipmentTracker({
  stage,
  trackingId,
  carrier,
  className,
}: {
  /** The current stage from ShipRocket, or null while nothing has been
   *  booked yet (shows a "shipment not booked" placeholder). */
  stage: ShipmentStage | null | undefined;
  trackingId?: string | null;
  carrier?: string | null;
  className?: string;
}) {
  if (!stage) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground",
          className,
        )}
      >
        <PackageSearch className="size-3.5" strokeWidth={1.75} />
        <span>Shipment not booked yet</span>
      </div>
    );
  }

  const reachedIndex = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2 text-xs">
        {STAGES.map((s, i) => {
          const reached = i <= reachedIndex;
          const current = i === reachedIndex;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border",
                  current
                    ? "border-gold/60 bg-gold/15 text-gold-bright"
                    : reached
                      ? "border-gold/30 bg-gold/5 text-gold-bright"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                <s.icon className="size-3.5" strokeWidth={1.75} />
              </span>
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "h-px w-6 sm:w-10",
                    i < reachedIndex ? "bg-gold/60" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-medium text-foreground">
          {STAGES[reachedIndex]?.label ?? "In transit"}
        </span>
        {trackingId && (
          <span className="font-mono text-muted-foreground">
            {carrier ? `${carrier} · ` : ""}
            AWB {trackingId}
          </span>
        )}
      </div>
    </div>
  );
}
