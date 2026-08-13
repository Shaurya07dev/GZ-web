// ---------------------------------------------------------------------------
// Shared chart theme for every chart in the admin console.
//
// COLOR: why this is a one-hue ramp and not eight categorical hues.
//
// The `dataviz` method wants categorical series to carry identity in HUE, from
// a fixed 8-slot order validated for colorblind separation. GalleryZone's design
// system does not have eight chart hues. It has one: brass. `app/globals.css`
// defines --chart-1..5 as gold-bright / gold / gold-deep plus two near-grey
// olives, in both themes. Running the skill's own validator over that set fails
// it as a categorical palette in both modes (chroma floor, and a normal-vision
// ΔE of 7.3 dark / 8.0 light between the two closest slots, against a floor of
// 15). Importing foreign hues to "fix" it was explicitly rejected: a teal or a
// violet series would be the only non-brass color anywhere in this product.
//
// So the palette is adapted rather than replaced. Every multi-series encoding
// here is treated as the skill's ORDINAL case: one hue, monotone lightness
// steps, validated with `validate_palette.js --ordinal`. Steps are produced by
// color-mix() between two brand tokens whose roles flip with the theme:
//
//     hi = var(--chart-1)     dark #e9c57a (gold-bright)   light #a9782c (gold)
//     lo = var(--gz-ramp-lo)  dark #8a6423 (gold-deep)     light #201c13 (ink)
//
// Dark recedes toward bronze, light deepens toward ink, because a light-mode
// ramp that fades toward the paper surface loses contrast immediately (measured:
// the pale end lands at 1.6:1, under the 2:1 ordinal floor). Validator result
// for n = 2..6 steps, both modes: lightness monotone PASS, adjacent ΔL PASS,
// light-end contrast PASS, single hue PASS, and every step at or above 3.5:1
// against the card surface.
//
// What the one-hue choice costs is hue-based identity, so secondary encoding is
// mandatory and is built in, not optional: a legend is always rendered for two
// or more series (ChartLegend in chart-card.tsx), stacked fills are separated by
// a 2px surface gap, line series carry direct end labels, and single-series bar
// charts carry direct value labels instead of a value axis.
//
// Nothing here hardcodes a hex. Every color is a var() onto a token that
// globals.css defines for both themes, so all six charts re-theme on toggle.
// ---------------------------------------------------------------------------

import type { CSSProperties } from "react";

// The lo end of the ramp is the only value that cannot be expressed with an
// existing token in both themes, so it is declared as a scoped custom property.
// Every ChartCard carries this class; the ramp resolves against it.
export const CHART_SCOPE_CLASS =
  "[--gz-ramp-lo:var(--foreground)] dark:[--gz-ramp-lo:var(--gold-deep)]";

export const CHART_RAMP_HI = "var(--chart-1)";
export const CHART_RAMP_LO = "var(--gz-ramp-lo, var(--foreground))";

/** Single-series accent: the strongest step of the ramp. */
export const CHART_ACCENT = CHART_RAMP_HI;

/** Surface color used for the 2px spacers between touching marks. */
export const CHART_SURFACE = "var(--card)";

/** Hairline, solid, one step off the surface. Never dashed. */
export const CHART_GRID = "var(--border)";

/** Axis text and any de-emphasised mark. Text never wears a series color. */
export const CHART_MUTED = "var(--muted-foreground)";

// --- ramp ------------------------------------------------------------------

/**
 * CSS custom properties for an `n`-step ramp, spread onto the chart's wrapper.
 * Emits `--gz-chart-0` (strongest) through `--gz-chart-{n-1}` (quietest).
 *
 * Emitting the steps as custom properties, rather than passing a color-mix()
 * string straight into an SVG `fill`, keeps every presentation attribute in the
 * shape this codebase already proves works: a bare `var(--x)`.
 */
export function rampVars(count: number): CSSProperties {
  const n = Math.max(1, Math.floor(count));
  const vars: Record<string, string> = {};
  for (let i = 0; i < n; i += 1) {
    const share = n === 1 ? 100 : Math.round((1 - i / (n - 1)) * 1000) / 10;
    vars[`--gz-chart-${i}`] =
      `color-mix(in oklab, ${CHART_RAMP_HI} ${share}%, ${CHART_RAMP_LO})`;
  }
  return vars as CSSProperties;
}

/** Reference step `index` of the ramp emitted by `rampVars`. */
export function rampVar(index: number): string {
  return `var(--gz-chart-${Math.max(0, Math.floor(index))})`;
}

// --- mark specs ------------------------------------------------------------

/** Bars are capped rather than filling their band, so the band keeps some air. */
export const BAR_MAX_SIZE = 24;
/** Rounded data-end, square at the baseline. */
export const BAR_RADIUS_UP: [number, number, number, number] = [4, 4, 0, 0];
export const BAR_RADIUS_RIGHT: [number, number, number, number] = [0, 4, 4, 0];
export const LINE_WIDTH = 2;
export const DOT_RADIUS = 4;
/** The 2px surface gap between stacked fills, and the ring on overlapping dots. */
export const SPACER_WIDTH = 2;

export const CHART_HEIGHT = {
  compact: 190,
  default: 260,
  tall: 320,
} as const;

// --- reusable Recharts prop bundles ----------------------------------------

/** Axis chrome: no tick marks, no axis rule, recessive text. */
export const axisChrome = {
  tickLine: false,
  axisLine: false,
  tick: { fill: CHART_MUTED, fontSize: 11 },
  tickMargin: 8,
};

/** Hairline solid gridlines, drawn only across the value axis. */
export const gridChrome = {
  stroke: CHART_GRID,
  strokeWidth: 1,
  strokeDasharray: undefined,
};

/** Crosshair cursor for line and area charts. */
export const crosshairCursor = { stroke: CHART_GRID, strokeWidth: 1 };

/** Block cursor for bar charts, one step off the surface. */
export const barCursor = { fill: "var(--muted)", fillOpacity: 0.55 };

export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };

// --- formatters ------------------------------------------------------------

function trimUnit(value: number): string {
  const text = value >= 100 ? value.toFixed(0) : value.toFixed(1);
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}

/**
 * Axis-length money. `formatINR` from lib/utils renders the full grouped amount
 * ("₹18,46,900"), which is far too long for a tick, so ticks get the Indian
 * short forms instead: ₹61.2k, ₹1.2L, ₹1.8Cr. Tooltips still use `formatINR`,
 * so the exact figure is always one hover away.
 */
export function formatCompactINR(value: number): string {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? "-" : "";
  const n = Math.abs(value);
  if (n >= 10000000) return `${sign}₹${trimUnit(n / 10000000)}Cr`;
  if (n >= 100000) return `${sign}₹${trimUnit(n / 100000)}L`;
  if (n >= 1000) return `${sign}₹${trimUnit(n / 1000)}k`;
  return `${sign}₹${Math.round(n)}`;
}

/** Same shortening for plain counts (orders, users, artworks). */
export function formatCompactCount(value: number): string {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? "-" : "";
  const n = Math.abs(value);
  if (n >= 10000000) return `${sign}${trimUnit(n / 10000000)}Cr`;
  if (n >= 100000) return `${sign}${trimUnit(n / 100000)}L`;
  if (n >= 1000) return `${sign}${trimUnit(n / 1000)}k`;
  return `${sign}${Math.round(n)}`;
}

/** Grouped count for tooltips and legends, e.g. "1,284". */
export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

/** Share of a total, e.g. "37%". Guards a zero total. */
export function formatShare(value: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

/**
 * Tick interval for dense time series. 30 daily points on a narrow card would
 * overlap, so long series drop to every nth label.
 */
export function tickInterval(pointCount: number): number {
  if (pointCount <= 14) return 0;
  return Math.ceil(pointCount / 8) - 1;
}
