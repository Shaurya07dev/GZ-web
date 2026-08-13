import { Percent, ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/utils";

// Static explainer, no query -- the 20%/30% split is a platform constant
// (Onboarding Guide's worked example), not per-holding data. The worked
// numbers below (₹30,000 listed -> ₹9,000 markup -> ₹1,800 aggregator
// share) match that guide's own example exactly, not an invented figure.
const WORKED_EXAMPLE = {
  listed: 30_000,
  markup: 9_000,
  aggregatorShare: 1_800,
};

export function CommissionExplainer() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gold/25 bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
          <Percent className="size-4 text-gold-bright" strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            You earn 20% of the 30% markup
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            On every aggregator-assisted sale, GalleryZone adds a 30% markup on
            top of the artist&rsquo;s price. You keep a 20% share of that markup
            as commission, on top of your advance.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-3 rounded-md border border-border bg-background px-4 py-3.5 text-sm">
        <ExampleFigure label="Listed price" value={WORKED_EXAMPLE.listed} />
        <ArrowRight
          className="size-3.5 shrink-0 text-muted-foreground"
          strokeWidth={1.75}
        />
        <ExampleFigure label="Platform markup" value={WORKED_EXAMPLE.markup} />
        <ArrowRight
          className="size-3.5 shrink-0 text-muted-foreground"
          strokeWidth={1.75}
        />
        <ExampleFigure
          label="Your share"
          value={WORKED_EXAMPLE.aggregatorShare}
          highlight
        />
      </div>
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
