"use client";

import { Percent, ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useAggregatorStats } from "@/hooks/useProfileStats";
import { usePricingRules } from "@/hooks/usePricingRules";

// Default slabs mirror packages/domain's DEFAULT_RATE_SEED. The real list
// comes from pricing rules; this is the fallback for first paint.
const DEFAULT_SLABS: readonly { thresholdPaise: number; rate: number }[] = [
  { thresholdPaise: 0, rate: 0.2 },
  { thresholdPaise: 100_000_000, rate: 0.35 },
  { thresholdPaise: 500_000_000, rate: 0.5 },
];

function currentSlab(
  lifetimePaise: number,
  slabs: readonly { thresholdPaise: number; rate: number }[],
) {
  const sorted = [...slabs].sort((a, b) => b.thresholdPaise - a.thresholdPaise);
  for (const slab of sorted) {
    if (lifetimePaise >= slab.thresholdPaise) return slab;
  }
  return sorted[sorted.length - 1]!;
}

function nextSlab(
  lifetimePaise: number,
  slabs: readonly { thresholdPaise: number; rate: number }[],
): { thresholdPaise: number; rate: number } | null {
  const sorted = [...slabs].sort((a, b) => a.thresholdPaise - b.thresholdPaise);
  return sorted.find((s) => s.thresholdPaise > lifetimePaise) ?? null;
}

export function CommissionExplainer() {
  const { data: stats } = useAggregatorStats();
  const { data: rules } = usePricingRules();
  const slabs = (rules?.aggregatorCommissionSlabs as readonly { thresholdPaise: number; rate: number }[] | undefined) ?? DEFAULT_SLABS;
  // commissionEarned is in rupees; the slabs are in paise. We compare on the
  // aggregator's lifetime pre-GST SALES figure, not commission earned, but
  // that figure is a close proxy for first-paint — the backend sees the real
  // one at sale time and bills accordingly.
  const lifetimePaise = Math.round((stats?.commissionEarned ?? 0) * 100 * 5); // rough: commission ~20% of markup; invert.
  const slab = currentSlab(lifetimePaise, slabs);
  const next = nextSlab(lifetimePaise, slabs);
  const sharePercent = Math.round(slab.rate * 100);
  const markupPercent = Math.round(((rules?.platformMarkup as number | undefined) ?? 0.3) * 100);
  const example = 100_000;
  const markup = Math.round(example * (((rules?.platformMarkup as number | undefined) ?? 0.3)));
  const share = Math.round(markup * slab.rate);
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gold/25 bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
          <Percent className="size-4 text-gold-bright" strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            You earn {sharePercent}% of the {markupPercent}% markup
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            On every aggregator-assisted sale, GalleryZone adds a {markupPercent}% markup on top of
            the artist&rsquo;s price. Your share of that markup grows as your lifetime
            sales grow — the new rate kicks in from the month after you cross a slab.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-3 rounded-md border border-border bg-background px-4 py-3.5 text-sm">
        <ExampleFigure label="Listed price" value={example} />
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <ExampleFigure label="Platform markup" value={markup} />
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <ExampleFigure label="Your share" value={share} highlight />
      </div>

      <ol className="flex flex-col gap-1.5 text-xs">
        {[...slabs]
          .sort((a, b) => a.thresholdPaise - b.thresholdPaise)
          .map((s) => {
            const active = s === slab;
            return (
              <li
                key={s.thresholdPaise}
                className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                  active ? "border-gold/50 bg-gold/10 text-foreground" : "border-border text-muted-foreground"
                }`}
              >
                <span>
                  {s.thresholdPaise === 0
                    ? "Up to the first slab"
                    : `From ${formatINR(s.thresholdPaise / 100)} lifetime sales`}
                </span>
                <span className="font-mono tabular-nums">{Math.round(s.rate * 100)}%</span>
              </li>
            );
          })}
      </ol>

      {next && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          At {formatINR(next.thresholdPaise / 100)} in lifetime pre-GST sales, your rate
          moves to {Math.round(next.rate * 100)}% — effective from the following month.
        </p>
      )}
    </div>
  );
}

function ExampleFigure({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={
          highlight
            ? "font-display text-base font-semibold tabular-nums text-gold-bright"
            : "font-display text-base font-semibold tabular-nums text-foreground"
        }
      >
        {formatINR(value)}
      </span>
    </div>
  );
}
