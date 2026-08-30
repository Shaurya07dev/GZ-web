import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ExpiryCountdownProps {
  expiresAt: string;
  className?: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// AggregatorHolding only carries expiresAt, not assignedAt, at this
// component's call sites -- but types/aggregator.ts documents the window as
// always exactly "assignedAt + 30 days" (SAD §2.7), so assignedAt is
// reconstructable as expiresAt minus 30 days without needing it passed in
// separately. "Now" is real time, captured once via useState's lazy
// initializer -- the codebase's own react-hooks/purity rule forbids a bare
// `Date.now()` in the render body, which is also why this used to read the
// fixed MOCK_TODAY anchor (aggregator-data.ts) that the STATIC seed fixtures
// are dated against. But a holding created by a live reserve() call is
// stamped with the real clock, so comparing it against a frozen fake "today"
// that drifts further from real time every day produced a wrong, growing
// days-left figure for every live reservation (e.g. reserved today, 30-day
// window, showing "48 days left"). The static fixtures still show something
// sane against real time; only a live reservation needs this to be correct.
export function ExpiryCountdown({
  expiresAt,
  className,
}: ExpiryCountdownProps) {
  const expires = new Date(expiresAt).getTime();
  const assigned = expires - THIRTY_DAYS_MS;
  const [now] = useState(() => Date.now());

  const elapsedMs = Math.min(Math.max(now - assigned, 0), THIRTY_DAYS_MS);
  const elapsedPercent = (elapsedMs / THIRTY_DAYS_MS) * 100;
  const daysLeft = Math.max(0, Math.ceil((expires - now) / ONE_DAY_MS));
  const urgent = daysLeft <= 3;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* Progress (components/ui/progress.tsx) always renders its own
          default Track/Indicator alongside any children passed to it, so
          children can't be used to customize color here without a visible
          double bar -- styling the nested data-slot elements directly via
          Tailwind's arbitrary-descendant variant (the same pattern already
          used in accordion.tsx/select.tsx) is the correct, non-duplicating
          way to recolor it per instance. */}
      <Progress
        value={elapsedPercent}
        className={cn(
          "gap-0 **:data-[slot=progress-track]:h-1.5",
          urgent
            ? "**:data-[slot=progress-indicator]:bg-destructive"
            : "**:data-[slot=progress-indicator]:bg-gold",
        )}
      />
      <span
        className={cn(
          "text-xs font-medium tabular-nums",
          urgent ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {daysLeft === 0
          ? "Expires today"
          : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
      </span>
    </div>
  );
}
