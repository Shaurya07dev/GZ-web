import { Check } from "lucide-react";
import type { OrderStatus, OrderStatusEvent } from "@/types/order";

// Same "vertical timeline of status + date" visual pattern as
// features/verify/provenance-timeline.tsx, reused directly (structure and
// styling untouched) with an order-shaped data source and label set instead
// of an artwork's provenance history.
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Order placed",
  paid: "Payment received",
  confirmed: "Order confirmed",
  packed: "Packed for dispatch",
  transit: "In transit",
  delivered: "Delivered",
  cancelled: "Order cancelled",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

interface OrderStatusTimelineProps {
  history: OrderStatusEvent[];
}

export function OrderStatusTimeline({ history }: OrderStatusTimelineProps) {
  const ordered = [...history].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
  );

  if (ordered.length === 0) return null;

  const isCancelled = ordered[ordered.length - 1]!.status === "cancelled";

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground">
        Order status
      </h2>
      <ol className="mt-5 flex flex-col">
        {ordered.map((event, index) => {
          const isLast = index === ordered.length - 1;
          const isCancelledStep = event.status === "cancelled";
          return (
            <li key={`${event.status}-${event.changedAt}`} className="relative flex gap-4 pb-7 last:pb-0">
              {!isLast && (
                <span
                  className="absolute top-6 left-[11px] h-full w-px bg-border"
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 flex size-[23px] shrink-0 items-center justify-center rounded-full border bg-card ${
                  isCancelledStep ? "border-destructive/50" : "border-gold/40"
                }`}
                aria-hidden="true"
              >
                <Check
                  className={`size-3 ${isCancelledStep ? "text-destructive" : "text-gold-bright"}`}
                  strokeWidth={2.5}
                />
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
      {!isCancelled && ordered[ordered.length - 1]!.status !== "delivered" && (
        <p className="mt-1 text-xs text-muted-foreground">
          We&rsquo;ll update this as your order moves.
        </p>
      )}
    </div>
  );
}
