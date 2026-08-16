"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { useArtistDashboardArtworks } from "@/hooks/useArtistArtworks";
import { useArtistOrders } from "@/hooks/useArtistOrders";
import { ChartCard, ChartTooltipContent } from "@/features/admin/charts/chart-card";
import {
  axisChrome,
  CHART_HEIGHT,
  CHART_MARGIN,
  crosshairCursor,
  formatCompactINR,
  gridChrome,
  rampVar,
  tickInterval,
} from "@/features/admin/charts/chart-theme";
import { CategoryBarChart } from "@/features/admin/charts/category-bar-chart";
import { FunnelChart } from "@/features/admin/charts/funnel-chart";
import type { CategoryPerformance, FunnelStage } from "@/lib/mock-data/admin-analytics";
import { REVENUE_SERIES } from "./dashboard-data";
import { formatINR } from "@/lib/utils";

export function ArtistAnalyticsView() {
  const { data: artworks } = useArtistDashboardArtworks();
  const { data: orders } = useArtistOrders();

  const rows = artworks ?? [];
  const soldRows = orders ?? [];

  const totalRevenue = soldRows.reduce((sum, o) => sum + o.artistPayout, 0);
  const salesCount = soldRows.length;
  const avgSale = salesCount > 0 ? Math.round(totalRevenue / salesCount) : 0;

  const categoryData = useMemo<CategoryPerformance[]>(() => {
    const byCategory = new Map<string, { revenue: number; orders: number }>();
    for (const artwork of artworks ?? []) {
      const entry = byCategory.get(artwork.category) ?? {
        revenue: 0,
        orders: 0,
      };
      if (artwork.status === "sold" || artwork.status === "settlement_complete") {
        entry.revenue += artwork.customerPrice;
        entry.orders += 1;
      }
      byCategory.set(artwork.category, entry);
    }
    return Array.from(byCategory.entries()).map(([category, v]) => ({
      category,
      revenue: v.revenue,
      orders: v.orders,
    }));
  }, [artworks]);

  const funnelData = useMemo<FunnelStage[]>(() => {
    const counts = { draft: 0, pending_approval: 0, live: 0, sold: 0 };
    for (const artwork of artworks ?? []) {
      if (artwork.status === "draft") counts.draft += 1;
      else if (artwork.status === "pending_approval") counts.pending_approval += 1;
      else if (artwork.status === "sold" || artwork.status === "settlement_complete")
        counts.sold += 1;
      else counts.live += 1;
    }
    return [
      { stage: "Draft", count: counts.draft },
      { stage: "Pending Approval", count: counts.pending_approval },
      { stage: "Live", count: counts.live },
      { stage: "Sold", count: counts.sold },
    ];
  }, [artworks]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat label="Total artworks" value={String(rows.length)} />
        <SummaryStat label="Total sales" value={String(salesCount)} />
        <SummaryStat label="Total revenue" value={formatINR(totalRevenue)} />
        <SummaryStat label="Avg. sale price" value={formatINR(avgSale)} />
      </div>

      <ArtistRevenueChart />

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryBarChart
          data={categoryData}
          description="Your own settled sales, by category."
        />
        <FunnelChart
          data={funnelData}
          title="Artwork status"
          description="Where your artworks currently sit, by count."
        />
      </div>
    </div>
  );
}

function ArtistRevenueChart() {
  const points = REVENUE_SERIES.map((p) => ({ label: p.month, amount: p.amount }));
  const isEmpty = points.length === 0;

  return (
    <ChartCard
      title="Revenue trend"
      description="Your settled earnings, last 6 months."
      seriesCount={1}
      height={CHART_HEIGHT.default}
      isEmpty={isEmpty}
      emptyTitle="No revenue yet"
      emptyDescription="Settled sales will show up here."
      ariaLabel={`Area chart of monthly revenue, last 6 months, totaling ${formatINR(
        points.reduce((sum, p) => sum + p.amount, 0),
      )}.`}
    >
      <AreaChart data={points} margin={CHART_MARGIN} accessibilityLayer={false}>
        <CartesianGrid {...gridChrome} vertical={false} />
        <XAxis
          {...axisChrome}
          dataKey="label"
          interval={tickInterval(points.length)}
          minTickGap={16}
        />
        <YAxis {...axisChrome} width={56} tickFormatter={formatCompactINR} />
        <Tooltip
          cursor={crosshairCursor}
          content={
            <ChartTooltipContent
              formatValue={formatINR}
              nameByKey={{ amount: "Revenue" }}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="amount"
          name="Revenue"
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
