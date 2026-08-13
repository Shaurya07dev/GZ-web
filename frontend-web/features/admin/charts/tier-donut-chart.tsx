"use client";

import type { ReactNode } from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";

import type { TierDistribution } from "@/lib/mock-data/admin-analytics";

import { ChartCard, ChartLegend, ChartTooltipContent } from "./chart-card";
import {
  CHART_HEIGHT,
  CHART_SURFACE,
  SPACER_WIDTH,
  formatCount,
  formatShare,
  rampVar,
} from "./chart-theme";

interface TierDonutChartProps {
  data: TierDistribution[];
  title?: string;
  description?: string;
  action?: ReactNode;
  height?: number;
  /** Word under the centred total, e.g. "artists". */
  centerLabel?: string;
  isLoading?: boolean;
  className?: string;
}

/**
 * Part-to-whole at a glance across four ordered tiers. A donut earns its place
 * here for two reasons: the segments are a genuine whole (every artist sits in
 * exactly one tier), and the hole holds the total, which is the number an
 * admin actually wants. It would be the wrong form for close values or for
 * more than about six segments.
 *
 * Tiers are ordinal (Gold outranks unverified), so they take the one-hue ramp
 * in tier order rather than four unrelated hues.
 */
export function TierDonutChart({
  data,
  title = "Verification tiers",
  description = "How far artists have progressed through verification.",
  action,
  height = CHART_HEIGHT.default,
  centerLabel = "artists",
  isLoading = false,
  className,
}: TierDonutChartProps) {
  const tiers = (data ?? []).filter((tier) => tier.count > 0);
  const isEmpty = tiers.length === 0;
  const total = tiers.reduce((sum, tier) => sum + tier.count, 0);

  return (
    <ChartCard
      title={title}
      description={description}
      action={action}
      seriesCount={Math.max(tiers.length, 1)}
      height={height}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyTitle="No artists to tier yet"
      emptyDescription="No artist has reached a verification tier."
      ariaLabel={buildAriaLabel(tiers, total, centerLabel)}
      overlay={<DonutTotal total={total} label={centerLabel} />}
      footer={
        <ChartLegend
          items={tiers.map((tier, index) => ({
            label: tier.tier,
            color: rampVar(index),
            value: `${formatCount(tier.count)} (${formatShare(tier.count, total)})`,
          }))}
        />
      }
      className={className}
    >
      <PieChart
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        accessibilityLayer={false}
      >
        <Tooltip
          content={
            <ChartTooltipContent
              formatValue={formatCount}
              note={(entry) => {
                const tier = entry.payload as TierDistribution | undefined;
                return tier ? formatShare(tier.count, total) : undefined;
              }}
            />
          }
        />
        <Pie
          data={tiers}
          dataKey="count"
          nameKey="tier"
          innerRadius="58%"
          outerRadius="86%"
          startAngle={90}
          endAngle={-270}
          // The 2px surface gap between touching segments, drawn in the card
          // color rather than as a decorative outline.
          stroke={CHART_SURFACE}
          strokeWidth={SPACER_WIDTH}
          isAnimationActive={false}
        >
          {tiers.map((tier, index) => (
            <Cell key={tier.tier} fill={rampVar(index)} />
          ))}
        </Pie>
      </PieChart>
    </ChartCard>
  );
}

/**
 * The centred total. Rendered as HTML over the plot rather than as an SVG
 * label so it uses the real type scale, and with proportional figures because
 * tabular-nums makes a large standalone number look loose.
 */
function DonutTotal({ total, label }: { total: number; label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <span className="font-sans text-3xl font-semibold leading-none text-foreground">
        {formatCount(total)}
      </span>
      <span className="mt-1 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function buildAriaLabel(
  tiers: TierDistribution[],
  total: number,
  centerLabel: string,
): string {
  if (!tiers.length) return "Verification tiers. No data.";
  const parts = tiers
    .map(
      (tier) =>
        `${tier.tier} ${formatCount(tier.count)} (${formatShare(tier.count, total)})`,
    )
    .join(", ");
  return `Donut chart of verification tiers across ${formatCount(total)} ${centerLabel}: ${parts}.`;
}
