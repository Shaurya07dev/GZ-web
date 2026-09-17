"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import type { VolumePoint } from "@/types/admin-analytics";

import { ChartCard, ChartTooltipContent } from "./chart-card";
import {
  axisChrome,
  barCursor,
  BAR_MAX_SIZE,
  BAR_RADIUS_UP,
  CHART_HEIGHT,
  CHART_MARGIN,
  formatCount,
  gridChrome,
  rampVar,
  tickInterval,
} from "./chart-theme";

interface VolumeBarChartProps {
  data: VolumePoint[];
  title?: string;
  description?: string;
  action?: ReactNode;
  height?: number;
  isLoading?: boolean;
  className?: string;
}

/**
 * One series, so one color and no legend: the card title already names what is
 * plotted, and a legend box with a single swatch would only restate it.
 */
export function VolumeBarChart({
  data,
  title = "Order volume",
  description = "Completed orders per period.",
  action,
  height = CHART_HEIGHT.default,
  isLoading = false,
  className,
}: VolumeBarChartProps) {
  const points = data ?? [];
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
      emptyTitle="No orders in this range"
      emptyDescription="No orders were placed inside the selected period."
      ariaLabel={buildAriaLabel(points)}
      className={className}
    >
      <BarChart data={points} margin={CHART_MARGIN} accessibilityLayer={false}>
        <CartesianGrid {...gridChrome} vertical={false} />
        <XAxis
          {...axisChrome}
          dataKey="label"
          interval={tickInterval(points.length)}
          minTickGap={16}
        />
        <YAxis {...axisChrome} width={36} allowDecimals={false} />
        <Tooltip
          cursor={barCursor}
          content={
            <ChartTooltipContent
              formatValue={formatCount}
              nameByKey={{ orders: "Orders" }}
            />
          }
        />
        <Bar
          dataKey="orders"
          name="Orders"
          fill={rampVar(0)}
          radius={BAR_RADIUS_UP}
          maxBarSize={BAR_MAX_SIZE}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartCard>
  );
}

function buildAriaLabel(points: VolumePoint[]): string {
  if (!points.length) return "Order volume. No data.";
  const total = points.reduce((sum, point) => sum + point.orders, 0);
  const peak = points.reduce((best, point) =>
    point.orders > best.orders ? point : best,
  );
  return `Bar chart of order volume from ${points[0].label} to ${points[points.length - 1].label}. ${formatCount(total)} orders in total, peaking at ${formatCount(peak.orders)} on ${peak.label}.`;
}
