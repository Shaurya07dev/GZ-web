"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RevenuePoint } from "@/lib/mock-data/admin-analytics";
import { formatINR } from "@/lib/utils";

import { ChartCard, ChartLegend, ChartTooltipContent } from "./chart-card";
import {
  axisChrome,
  CHART_HEIGHT,
  CHART_MARGIN,
  CHART_SURFACE,
  SPACER_WIDTH,
  crosshairCursor,
  formatCompactINR,
  gridChrome,
  rampVar,
  tickInterval,
} from "./chart-theme";

interface RevenueAreaChartProps {
  data: RevenuePoint[];
  title?: string;
  description?: string;
  action?: ReactNode;
  height?: number;
  isLoading?: boolean;
  className?: string;
}

// Stack order is bottom to top by share size, which is also the order the ramp
// runs in reverse: the artist band is roughly 77% of GMV and takes the quietest
// step, the platform's own cut takes the brightest. Saturated brass belongs on
// the thin bands, never on the big block.
const SERIES = [
  { key: "artist", label: "Artist payouts", color: rampVar(2) },
  { key: "platform", label: "Platform revenue", color: rampVar(1) },
  { key: "aggregator", label: "Aggregator commission", color: rampVar(0) },
] as const;

const NAME_BY_KEY = Object.fromEntries(SERIES.map((s) => [s.key, s.label]));

export function RevenueAreaChart({
  data,
  title = "Revenue by destination",
  description = "Where every rupee of gross merchandise value ends up.",
  action,
  height = CHART_HEIGHT.default,
  isLoading = false,
  className,
}: RevenueAreaChartProps) {
  const points = data ?? [];
  const isEmpty = points.length === 0;

  return (
    <ChartCard
      title={title}
      description={description}
      action={action}
      seriesCount={SERIES.length}
      height={height}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyTitle="No revenue in this range"
      emptyDescription="No settled sales fall inside the selected period."
      ariaLabel={buildAriaLabel(points)}
      footer={
        <ChartLegend
          items={SERIES.map((series) => ({
            label: series.label,
            color: series.color,
          }))}
        />
      }
      className={className}
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
              nameByKey={NAME_BY_KEY}
              totalLabel="Gross merchandise value"
            />
          }
        />
        {SERIES.map((series) => (
          <Area
            key={series.key}
            type="monotone"
            dataKey={series.key}
            name={series.label}
            stackId="revenue"
            fill={series.color}
            fillOpacity={1}
            // The 2px surface gap that keeps touching bands legible. This is
            // the spacer, not a decorative border: it is the surface color.
            stroke={CHART_SURFACE}
            strokeWidth={SPACER_WIDTH}
            isAnimationActive={false}
            activeDot={false}
          />
        ))}
      </AreaChart>
    </ChartCard>
  );
}

function buildAriaLabel(points: RevenuePoint[]): string {
  if (!points.length) return "Revenue by destination. No data.";
  const total = points.reduce((sum, point) => sum + point.gmv, 0);
  const first = points[0].label;
  const last = points[points.length - 1].label;
  return `Stacked area chart of revenue by destination from ${first} to ${last}, split into artist payouts, platform revenue and aggregator commission. Total gross merchandise value ${formatINR(total)} across ${points.length} periods.`;
}
