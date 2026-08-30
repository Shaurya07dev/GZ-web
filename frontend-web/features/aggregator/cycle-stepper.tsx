import { cn } from "@/lib/utils";
import { AGGREGATOR_CYCLE_MONTHS } from "@/lib/pricing";

interface CycleStepperProps {
  currentMonth: number;
  totalMonths?: number;
  size?: "sm" | "default";
  className?: string;
}

// The one thing every screen in this flow needs to make legible at a glance:
// a piece that doesn't sell rotates to a DIFFERENT aggregator each month, up
// to five times, cheaper each time. A number ("month 3 of 5") states that but
// doesn't show it — this renders the whole five-step track so where you stand
// in the rotation, and how much of it is behind/ahead of you, reads visually
// instead of needing to be worked out from text. Used on the browse grid, the
// reserve page, and the holding detail page so the same shape means the same
// thing everywhere in the portal.
export function CycleStepper({
  currentMonth,
  totalMonths = AGGREGATOR_CYCLE_MONTHS,
  size = "default",
  className,
}: CycleStepperProps) {
  const dotSize = size === "sm" ? "size-4 text-[9px]" : "size-6 text-[11px]";
  const steps = Array.from({ length: totalMonths }, (_, i) => i + 1);

  return (
    <div className={cn("flex items-center", className)}>
      {steps.map((month) => (
        <div key={month} className="flex flex-1 items-center last:flex-none">
          <span
            title={`Month ${month}`}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full border font-medium tabular-nums",
              dotSize,
              month < currentMonth &&
                "border-gold/40 bg-gold/10 text-gold-bright",
              month === currentMonth &&
                "border-gold bg-gold-bright text-[#171310]",
              month > currentMonth &&
                "border-border text-muted-foreground/70",
            )}
          >
            {size === "sm" ? "" : month}
          </span>
          {month < totalMonths && (
            <span
              className={cn(
                "h-px flex-1",
                month < currentMonth ? "bg-gold/40" : "bg-border",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
