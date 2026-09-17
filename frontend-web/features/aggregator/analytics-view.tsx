"use client";

import { useAggregatorCollection } from "@/hooks/useAggregatorCollection";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { useAggregatorAnalytics } from "@/hooks/useAggregatorAnalytics";
import { useAggregatorSales } from "@/hooks/useAggregatorSales";
import { ChartCard, ChartTooltipContent } from "@/features/admin/charts/chart-card";
import { CategoryBarChart } from "@/features/admin/charts/category-bar-chart";
import {
  axisChrome,
  CHART_HEIGHT,
  CHART_MARGIN,
  crosshairCursor,
  gridChrome,
  rampVar,
  tickInterval,
} from "@/features/admin/charts/chart-theme";
import type { CategoryPerformance } from "@/types/admin-analytics";
import { formatINR } from "@/lib/utils";

// Pre-baked demonstration series, same honest posture as
// lib/mock-data/admin-analytics.ts: a handful of real fixture rows can't
// produce a believable 6-month trend on their own, so this one chart is
// illustrative, not derived from live sales. Every other number on this
// page (the summary tiles, the category breakdown) IS live.
const SELL_THROUGH_DEMO_SERIES = [
  { month: "Mar", rate: 38 },
  { month: "Apr", rate: 44 },
  { month: "May", rate: 41 },
  { month: "Jun", rate: 52 },
  { month: "Jul", rate: 58 },
  { month: "Aug", rate: 61 },
];

export function AnalyticsView() {
  const { data: summary, isPending } = useAggregatorAnalytics();
  const { data: sales } = useAggregatorSales();
  const { data: holdings } = useAggregatorCollection();

  const categoryData = useMemo<CategoryPerformance[]>(() => {
    const byCategory = new Map<string, { revenue: number; orders: number }>();
    for (const sale of sales ?? []) {
      const artwork = holdings?.find((h) => h.artworkId === sale.artworkId)?.artwork;
      if (!artwork) continue;
      const entry = byCategory.get(artwork.category) ?? {
        revenue: 0,
        orders: 0,
      };
      entry.revenue += sale.soldPrice;
      entry.orders += 1;
      byCategory.set(artwork.category, entry);
    }
    return Array.from(byCategory.entries()).map(([category, v]) => ({
      category,
      revenue: v.revenue,
      orders: v.orders,
    }));
  }, [sales]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat
          label="Sales recorded"
          value={isPending ? "—" : String(summary?.salesCount ?? 0)}
        />
        <SummaryStat
          label="Total revenue"
          value={isPending ? "—" : formatINR(summary?.totalRevenue ?? 0)}
        />
        <SummaryStat
          label="Avg. sold price"
          value={isPending ? "—" : formatINR(summary?.averageSoldPrice ?? 0)}
        />
        <SummaryStat
          label="Avg. display markup"
          value={
            isPending ? "—" : formatINR(summary?.averageDisplayMarkup ?? 0)
          }
        />
      </div>

      <SellThroughChart />

      <CategoryBarChart
        data={categoryData}
        title="Top categories moved"
        description="Revenue from your recorded sales, by artwork category."
      />
    </div>
  );
}

function SellThroughChart() {
  const points = SELL_THROUGH_DEMO_SERIES;

  return (
    <ChartCard
      title="Sell-through rate"
      description="Demonstration trend — illustrative, not derived from live fixture data."
      seriesCount={1}
      height={CHART_HEIGHT.default}
      ariaLabel={`Area chart of monthly sell-through rate, last 6 months, ending at ${points[points.length - 1]?.rate ?? 0}%.`}
    >
      <AreaChart data={points} margin={CHART_MARGIN} accessibilityLayer={false}>
        <CartesianGrid {...gridChrome} vertical={false} />
        <XAxis
          {...axisChrome}
          dataKey="month"
          interval={tickInterval(points.length)}
          minTickGap={16}
        />
        <YAxis {...axisChrome} width={40} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          cursor={crosshairCursor}
          content={
            <ChartTooltipContent
              formatValue={(v) => `${v}%`}
              nameByKey={{ rate: "Sell-through" }}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="rate"
          name="Sell-through"
          fill={rampVar(0)}
          fillOpacity={0.25}
          stroke={rampVar(0)}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartCard>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 font-display text-xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
