"use client";

import { motion } from "framer-motion";
import { BookmarkCheck, IndianRupee, Banknote } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceTag } from "@/components/shared/price-tag";
import { useAggregatorDashboard } from "@/hooks/useAggregatorDashboard";

// A fork of features/dashboard/kpi-cards.tsx's visual pattern (identical
// card shell, stagger-in motion), not a shared/generalized component --
// that file is hardcoded to the artist's static KPI_METRICS array, not
// generic over a metric/label/value prop, so reusing it directly isn't an
// option (see Task 21's identical reasoning for AggregatorShell). This
// version is data-driven from useAggregatorDashboard() instead of a static
// fixture, so it needs its own loading/error handling that the artist
// version never had to worry about.
const METRIC_META = [
  {
    key: "activeReservations",
    label: "Active reservations",
    icon: BookmarkCheck,
  },
  { key: "commissionEarned", label: "Commission earned", icon: IndianRupee },
  { key: "pendingSettlements", label: "Pending settlements", icon: Banknote },
] as const;

export function AggregatorKpiCards() {
  const { data, isPending, isError } = useAggregatorDashboard();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {METRIC_META.map((metric, i) => (
        <motion.div
          key={metric.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: "easeOut" }}
          className="rounded-lg border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {metric.label}
            </span>
            <metric.icon
              className="size-4 text-gold-bright"
              strokeWidth={1.75}
            />
          </div>

          {isPending ? (
            <Skeleton className="mt-3 h-9 w-24" />
          ) : isError || !data ? (
            <p className="mt-3 font-display text-2xl font-semibold text-muted-foreground">
              &mdash;
            </p>
          ) : metric.key === "commissionEarned" ? (
            <PriceTag
              amount={data.commissionEarned}
              className="mt-3 block font-display text-3xl font-semibold tabular-nums"
            />
          ) : (
            <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-foreground">
              {data[metric.key]}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
