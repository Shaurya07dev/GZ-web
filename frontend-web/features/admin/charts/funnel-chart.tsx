"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FunnelStage } from "@/lib/mock-data/admin-analytics";

import { ChartCard, ChartTooltipContent } from "./chart-card";
import {
  axisChrome,
  barCursor,
  BAR_MAX_SIZE,
  BAR_RADIUS_RIGHT,
  CHART_HEIGHT,
  CHART_MUTED,
  formatCompactCount,
  formatCount,
  formatShare,
  rampVar,
} from "./chart-theme";

interface FunnelChartProps {
  data: FunnelStage[];
  title?: string;
  description?: string;
  action?: ReactNode;
  height?: number;
  isLoading?: boolean;
  className?: string;
}

/**
 * The artwork lifecycle, drawn as descending horizontal bars rather than a
 * literal funnel trapezoid. A trapezoid encodes each stage as an area whose
 * width is not proportional to its count, so it systematically overstates the
 * tail; bar length is honest and easier to compare.
 *
 * Stages are ordinal, not nominal: reordering them would change the meaning.
 * That is exactly the case the one-hue lightness ramp is for, so intensity
 * fades as the artwork moves down the pipeline.
 */
export function FunnelChart({
  data,
  title = "Artwork lifecycle",
  description = "Every artwork ever submitted, by the furthest stage it reached.",
  action,
  height = CHART_HEIGHT.default,
  isLoading = false,
  className,
}: FunnelChartProps) {
  const stages = data ?? [];
  const isEmpty = stages.length === 0;
  const top = stages[0]?.count ?? 0;

  return (
    <ChartCard
      title={title}
      description={description}
      action={action}
      seriesCount={Math.max(stages.length, 1)}
      height={height}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyTitle="No artworks submitted yet"
      emptyDescription="Nothing has entered the lifecycle so far."
      ariaLabel={buildAriaLabel(stages)}
      className={className}
    >
      <BarChart
        data={stages}
        layout="vertical"
        margin={{ top: 4, right: 56, bottom: 4, left: 0 }}
        accessibilityLayer={false}
      >
        <XAxis type="number" dataKey="count" hide />
        <YAxis
          {...axisChrome}
          type="category"
          dataKey="stage"
          width={112}
          tickMargin={10}
        />
        <Tooltip
          cursor={barCursor}
          content={
            <ChartTooltipContent
              formatValue={formatCount}
              nameByKey={{ count: "Artworks" }}
              note={(entry) => {
                const stage = entry.payload as FunnelStage | undefined;
                if (!stage || !top) return undefined;
                return `${formatShare(stage.count, top)} of submitted`;
              }}
            />
          }
        />
        <Bar
          dataKey="count"
          name="Artworks"
          radius={BAR_RADIUS_RIGHT}
          maxBarSize={BAR_MAX_SIZE}
          isAnimationActive={false}
        >
          {stages.map((stage, index) => (
            <Cell key={stage.stage} fill={rampVar(index)} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            offset={10}
            fill={CHART_MUTED}
            fontSize={11}
            formatter={(value) => formatCompactCount(Number(value))}
          />
        </Bar>
      </BarChart>
    </ChartCard>
  );
}

function buildAriaLabel(stages: FunnelStage[]): string {
  if (!stages.length) return "Artwork lifecycle. No data.";
  const first = stages[0];
  const last = stages[stages.length - 1];
  const parts = stages
    .map((stage) => `${stage.stage} ${formatCount(stage.count)}`)
    .join(", ");
  return `Funnel chart of the artwork lifecycle: ${parts}. ${formatShare(last.count, first.count)} of ${first.stage.toLowerCase()} artworks reach ${last.stage.toLowerCase()}.`;
}
