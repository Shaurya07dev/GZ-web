"use client";

import { TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAggregatorDashboard } from "@/hooks/useAggregatorDashboard";

// Conversion = sold / (sold + returned) -- see dashboardSummary()'s comment
// for why still-active reservations aren't counted in the denominator.
export function SalesConversionCard() {
  const { data, isPending, isError } = useAggregatorDashboard();

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
          <TrendingUp className="size-4 text-gold-bright" strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            Sales conversion
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Of the reservations you&rsquo;ve concluded, the share that ended in
            a sale rather than a return.
          </p>
        </div>
      </div>

      {isPending ? (
        <Skeleton className="h-10 w-24" />
      ) : isError || !data || data.conversionRate === null ? (
        <p className="font-display text-3xl font-semibold text-muted-foreground">
          &mdash;
        </p>
      ) : (
        <p className="font-display text-3xl font-semibold tabular-nums text-gold-bright">
          {data.conversionRate}%
        </p>
      )}
    </div>
  );
}
