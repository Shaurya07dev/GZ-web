"use client";

import type { ReactElement, ReactNode } from "react";
import { ChartNoAxesColumn } from "lucide-react";
import { ResponsiveContainer } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

import { CHART_HEIGHT, CHART_SCOPE_CLASS, rampVars } from "./chart-theme";

interface ChartCardProps {
  title: string;
  /** One line under the title. Say what is plotted, not how to read it. */
  description?: string;
  /** Right-side control slot, e.g. the analytics range selector. */
  action?: ReactNode;
  /**
   * Steps the chart needs from the shared ramp. Emits `--gz-chart-0..n-1`
   * onto this card, which every mark inside then references via `rampVar(i)`.
   */
  seriesCount?: number;
  /** Plot height in px, including the axis band. */
  height?: number;
  /** Screen-reader summary of the plot. Required, because a chart is a graphic. */
  ariaLabel: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Below the plot: the legend, a note, a compact key. */
  footer?: ReactNode;
  /** Absolutely positioned over the plot, e.g. a donut's centred total. */
  overlay?: ReactNode;
  className?: string;
  /** Exactly one Recharts chart element. */
  children: ReactElement;
}

/**
 * The frame every admin chart sits in, so the analytics page reads as one
 * system rather than six independently styled widgets: shared header, shared
 * ramp scope, shared plot height, shared loading and empty states.
 *
 * The plot wrapper is `role="img"` with an `aria-label`, matching the
 * convention the existing hand-rolled features/dashboard/revenue-chart.tsx
 * already set. Charts inside therefore pass `accessibilityLayer={false}`: a
 * labelled graphic must not contain focusable descendants, and Recharts' own
 * layer would add a `tabIndex` inside it. Values stay reachable without hover
 * because the single-series charts direct-label every bar.
 */
export function ChartCard({
  title,
  description,
  action,
  seriesCount = 1,
  height = CHART_HEIGHT.default,
  ariaLabel,
  isLoading = false,
  isEmpty = false,
  emptyTitle = "No data for this range",
  emptyDescription = "Nothing has been recorded for the selected period yet.",
  footer,
  overlay,
  className,
  children,
}: ChartCardProps) {
  // A refetch holds the previous render at reduced opacity instead of flashing
  // a skeleton, so the card never jumps. Only a cold load gets the skeleton.
  const showSkeleton = isLoading && isEmpty;
  const isRefreshing = isLoading && !isEmpty;

  return (
    <Card
      className={cn(CHART_SCOPE_CLASS, className)}
      style={rampVars(seriesCount)}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {showSkeleton ? (
          <Skeleton className="w-full rounded-md" style={{ height }} />
        ) : isEmpty ? (
          <EmptyState
            icon={ChartNoAxesColumn}
            title={emptyTitle}
            description={emptyDescription}
            className="border-0 px-2 py-10"
          />
        ) : (
          <div
            role="img"
            aria-label={ariaLabel}
            style={{ height }}
            className={cn(
              "relative w-full transition-opacity duration-200",
              isRefreshing && "opacity-60"
            )}
          >
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
            {overlay}
          </div>
        )}

        {footer && !showSkeleton && !isEmpty && footer}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

export interface ChartLegendItem {
  label: string;
  /** A ramp step, e.g. `rampVar(0)`. */
  color: string;
  /** Optional already-formatted figure shown beside the label. */
  value?: string;
}

/**
 * One legend for every chart in the console, rather than Recharts' built-in
 * one, so the swatch, spacing and type match across cartesian and polar charts.
 *
 * Always rendered for two or more series. A single-series chart gets none: the
 * card title already names what is plotted. Labels wear text tokens; the
 * coloured dot beside them carries identity.
 */
export function ChartLegend({
  items,
  className,
}: {
  items: ChartLegendItem[];
  className?: string;
}) {
  if (items.length < 2) return null;

  return (
    <ul className={cn("flex flex-wrap items-center gap-x-5 gap-y-2", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: item.color }}
          />
          <span className="text-xs text-muted-foreground">{item.label}</span>
          {item.value && (
            <span className="text-xs font-medium text-foreground tabular-nums">
              {item.value}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipEntry {
  name?: string | number;
  value?: string | number | Array<string | number>;
  dataKey?: string | number;
  color?: string;
  /** The source row this mark came from. Cast it to your own point type. */
  payload?: unknown;
}

interface ChartTooltipContentProps {
  /** Injected by Recharts when it clones this element. */
  active?: boolean;
  label?: ReactNode;
  payload?: ReadonlyArray<TooltipEntry>;
  /** How each value is rendered. Tooltips have room for the full figure. */
  formatValue?: (value: number) => string;
  /** Human labels per dataKey, so the tooltip does not leak field names. */
  nameByKey?: Record<string, string>;
  /** Appends a summed row under the series rows. */
  totalLabel?: string;
  /** Extra line under the rows, e.g. a conversion share. */
  note?: (entry: TooltipEntry) => string | undefined;
}

/** Shared tooltip body: popover surface, hairline ring, text tokens only. */
export function ChartTooltipContent({
  active,
  label,
  payload,
  formatValue = (value) => String(value),
  nameByKey,
  totalLabel,
  note,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;

  const rows = payload.filter((entry) => typeof toNumber(entry.value) === "number");
  if (!rows.length) return null;

  const total = rows.reduce((sum, entry) => sum + (toNumber(entry.value) ?? 0), 0);

  return (
    <div className="min-w-40 rounded-lg bg-popover px-3 py-2.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
      {label !== undefined && label !== null && (
        <p className="mb-1.5 text-xs font-medium text-foreground">{label}</p>
      )}
      <ul className="flex flex-col gap-1">
        {rows.map((entry, index) => {
          const key = String(entry.dataKey ?? entry.name ?? index);
          const value = toNumber(entry.value) ?? 0;
          const extra = note?.(entry);
          return (
            <li key={key} className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: entry.color }}
              />
              <span className="mr-auto text-xs text-muted-foreground">
                {nameByKey?.[key] ?? String(entry.name ?? key)}
                {extra && <span className="ml-1.5 text-muted-foreground/70">{extra}</span>}
              </span>
              <span className="text-xs font-medium text-foreground tabular-nums">
                {formatValue(value)}
              </span>
            </li>
          );
        })}
      </ul>
      {totalLabel && rows.length > 1 && (
        <div className="mt-2 flex items-center gap-2.5 border-t border-border pt-1.5">
          <span className="mr-auto text-xs text-muted-foreground">{totalLabel}</span>
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {formatValue(total)}
          </span>
        </div>
      )}
    </div>
  );
}

function toNumber(value: TooltipEntry["value"]): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
