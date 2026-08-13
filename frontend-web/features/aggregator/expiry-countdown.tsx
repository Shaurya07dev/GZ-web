import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { MOCK_TODAY } from "./aggregator-data";

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
// separately. "Now" is MOCK_TODAY (not real Date.now()), matching every
// other aggregator fixture's fixed anchor -- see aggregator-data.ts's
// comment on why real wall-clock time would silently drift the seeded
// "expires in 2..25 days" spread as actual time passes.
export function ExpiryCountdown({ expiresAt, className }: ExpiryCountdownProps) {
  const expires = new Date(expiresAt).getTime();
  const assigned = expires - THIRTY_DAYS_MS;
  const now = MOCK_TODAY.getTime();

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
            : "**:data-[slot=progress-indicator]:bg-gold"
        )}
      />
      <span
        className={cn(
          "text-xs font-medium tabular-nums",
          urgent ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {daysLeft === 0 ? "Expires today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
      </span>
    </div>
  );
}
