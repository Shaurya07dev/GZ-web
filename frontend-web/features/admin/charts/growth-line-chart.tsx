"use client";

import type { ReactNode } from "react";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { UserGrowthPoint } from "@/lib/mock-data/admin-analytics";

import { ChartCard, ChartLegend, ChartTooltipContent } from "./chart-card";
import {
  axisChrome,
  CHART_HEIGHT,
  CHART_MUTED,
  CHART_SURFACE,
  DOT_RADIUS,
  LINE_WIDTH,
  SPACER_WIDTH,
  crosshairCursor,
  formatCount,
  gridChrome,
  rampVar,
  tickInterval,
} from "./chart-theme";

interface GrowthLineChartProps {
  data: UserGrowthPoint[];
  title?: string;
  description?: string;
  action?: ReactNode;
  height?: number;
  isLoading?: boolean;
  className?: string;
}

// Ordered by population, so the brightest step lands on the largest role.
const SERIES = [
  { key: "artists", label: "Artists", color: rampVar(0) },
  { key: "customers", label: "Customers", color: rampVar(1) },
  { key: "aggregators", label: "Aggregators", color: rampVar(2) },
] as const;

const NAME_BY_KEY = Object.fromEntries(SERIES.map((s) => [s.key, s.label]));

/**
 * Cumulative accounts per role. Lines are the hardest case for a one-hue
 * palette, so identity is carried twice over: a legend, plus the role name
 * direct-labelled at each line's right-hand end. Only the endpoint is
 * labelled; a value beside every point would be unreadable at 30 points.
 */
export function GrowthLineChart({
  data,
  title = "User growth by role",
  description = "Cumulative accounts, not new signups per period.",
  action,
  height = CHART_HEIGHT.default,
  isLoading = false,
  className,
}: GrowthLineChartProps) {
  const points = data ?? [];
  const isEmpty = points.length === 0;
  const lastIndex = points.length - 1;
  const final = points[lastIndex];

  return (
    <ChartCard
      title={title}
      description={description}
      action={action}
      seriesCount={SERIES.length}
      height={height}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyTitle="No signups in this range"
      emptyDescription="No accounts were created inside the selected period."
      ariaLabel={buildAriaLabel(points)}
      footer={
        <ChartLegend
          items={SERIES.map((series) => ({
            label: series.label,
            color: series.color,
            value: final ? formatCount(final[series.key]) : undefined,
          }))}
        />
      }
      className={className}
    >
      <LineChart
        data={points}
        margin={{ top: 8, right: 84, bottom: 0, left: 0 }}
        accessibilityLayer={false}
      >
        <CartesianGrid {...gridChrome} vertical={false} />
        <XAxis
          {...axisChrome}
          dataKey="label"
          interval={tickInterval(points.length)}
          minTickGap={16}
        />
        <YAxis {...axisChrome} width={36} allowDecimals={false} />
        <Tooltip
          cursor={crosshairCursor}
          content={
            <ChartTooltipContent
              formatValue={formatCount}
              nameByKey={NAME_BY_KEY}
            />
          }
        />
        {SERIES.map((series) => (
          <Line
            key={series.key}
            type="monotone"
            dataKey={series.key}
            name={series.label}
            stroke={series.color}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            // A 2px ring in the surface color keeps the active dot legible
            // where two lines cross.
            activeDot={{
              r: DOT_RADIUS,
              stroke: CHART_SURFACE,
              strokeWidth: SPACER_WIDTH,
            }}
            isAnimationActive={false}
          >
            <LabelList
              dataKey={series.key}
              position="right"
              offset={12}
              fill={CHART_MUTED}
              fontSize={11}
              valueAccessor={(_entry, index) =>
                index === lastIndex ? series.label : null
              }
            />
          </Line>
        ))}
      </LineChart>
    </ChartCard>
  );
}

function buildAriaLabel(points: UserGrowthPoint[]): string {
  if (!points.length) return "User growth by role. No data.";
  const first = points[0];
  const last = points[points.length - 1];
  const parts = SERIES.map(
    (series) => `${series.label} ${first[series.key]} to ${last[series.key]}`,
  ).join(", ");
  return `Line chart of cumulative accounts by role from ${first.label} to ${last.label}: ${parts}.`;
}
