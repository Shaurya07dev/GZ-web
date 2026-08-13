import { REVENUE_SERIES } from "./dashboard-data";

const WIDTH = 480;
const HEIGHT = 140;
const GAP = 14;

export function RevenueChart() {
  const max = Math.max(...REVENUE_SERIES.map((point) => point.amount));
  const barWidth =
    (WIDTH - GAP * (REVENUE_SERIES.length - 1)) / REVENUE_SERIES.length;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold text-foreground">
          Revenue
        </h2>
        <span className="text-xs text-muted-foreground">Last 6 months</span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-5 h-36 w-full overflow-visible"
        role="img"
        aria-label="Monthly revenue for the last six months"
      >
        <defs>
          <linearGradient id="revenue-bar" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--gold-bright)"
              stopOpacity="0.95"
            />
            <stop
              offset="100%"
              stopColor="var(--gold-deep)"
              stopOpacity="0.6"
            />
          </linearGradient>
        </defs>
        {REVENUE_SERIES.map((point, i) => {
          const barHeight = (point.amount / max) * (HEIGHT - 24);
          const x = i * (barWidth + GAP);
          const isLast = i === REVENUE_SERIES.length - 1;
          return (
            <g key={point.month}>
              <rect
                x={x}
                y={HEIGHT - 24 - barHeight}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={isLast ? "url(#revenue-bar)" : "var(--muted)"}
              />
              <text
                x={x + barWidth / 2}
                y={HEIGHT - 4}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {point.month}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
