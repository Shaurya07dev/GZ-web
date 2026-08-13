"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, LabelList, Tooltip, XAxis, YAxis } from "recharts";

import type { CategoryPerformance } from "@/lib/mock-data/admin-analytics";
import { formatINR } from "@/lib/utils";

import { ChartCard, ChartTooltipContent } from "./chart-card";
import {
  axisChrome,
  barCursor,
  BAR_MAX_SIZE,
  BAR_RADIUS_RIGHT,
  CHART_HEIGHT,
  CHART_MUTED,
  formatCompactINR,
  formatCount,
  rampVar,
} from "./chart-theme";

interface CategoryBarChartProps {
  data: CategoryPerformance[];
  title?: string;
  description?: string;
  action?: ReactNode;
  height?: number;
  isLoading?: boolean;
  className?: string;
}

/**
 * Horizontal bars, every bar the same color. Categories here are nominal:
 * "Painting" is not more or less than "Sculpture", so darkening the bigger
 * bars would spend the identity channel re-encoding what bar length already
 * shows. Bar length is the only value channel.
 *
 * There is no value axis. Each bar is direct-labelled with its revenue
 * instead, which is both shorter to read and the accessible route to the
 * number without hovering.
 */
export function CategoryBarChart({
  data,
  title = "Revenue by category",
  description = "Trailing twelve months, highest first.",
  action,
  height = CHART_HEIGHT.default,
  isLoading = false,
  className,
}: CategoryBarChartProps) {
  // Sort a copy: the fixture array is shared with the rest of the console.
  const points = [...(data ?? [])].sort((a, b) => b.revenue - a.revenue);
  const isEmpty = points.length === 0;

  return (
    <ChartCard
      title={title}
      description={description}
      action={action}
      seriesCount={1}
      height={height}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyTitle="No category revenue yet"
      emptyDescription="No category has recorded a settled sale."
      ariaLabel={buildAriaLabel(points)}
      className={className}
    >
      <BarChart
        data={points}
        layout="vertical"
        margin={{ top: 4, right: 64, bottom: 4, left: 0 }}
        accessibilityLayer={false}
      >
        <XAxis type="number" dataKey="revenue" hide />
        <YAxis
          {...axisChrome}
          type="category"
          dataKey="category"
          width={104}
          tickMargin={10}
        />
        <Tooltip
          cursor={barCursor}
          content={
            <ChartTooltipContent
              formatValue={formatINR}
              nameByKey={{ revenue: "Revenue" }}
              note={(entry) => {
                const orders = (
                  entry.payload as CategoryPerformance | undefined
                )?.orders;
                return orders === undefined
                  ? undefined
                  : `${formatCount(orders)} orders`;
              }}
            />
          }
        />
        <Bar
          dataKey="revenue"
          name="Revenue"
          fill={rampVar(0)}
          radius={BAR_RADIUS_RIGHT}
          maxBarSize={BAR_MAX_SIZE}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="revenue"
            position="right"
            offset={10}
            fill={CHART_MUTED}
            fontSize={11}
            formatter={(value) => formatCompactINR(Number(value))}
          />
        </Bar>
      </BarChart>
    </ChartCard>
  );
}

function buildAriaLabel(points: CategoryPerformance[]): string {
  if (!points.length) return "Revenue by category. No data.";
  const total = points.reduce((sum, point) => sum + point.revenue, 0);
  const parts = points
    .map((point) => `${point.category} ${formatINR(point.revenue)}`)
    .join(", ");
  return `Horizontal bar chart of revenue by category, ${formatINR(total)} in total: ${parts}.`;
}
