import { cn, formatINR } from "@/lib/utils";

// The one price breakdown, used by both checkout steps and the receipt on a
// past order. GST is ALREADY part of `displayPrice` — shown as a sub-note so
// the buyer can see the tax component, never added to the total.
//
// Payment-processing fee and its 18% service GST are combined into ONE row
// (client flag 13 Nov 2026: splitting them made the sheet feel noisy and
// the row sum confused people). The sub-note shows the "incl 18% GST" so the
// invoice math is still auditable.

export interface PriceBreakdownProps {
  /** The artwork's listed price, GST included. */
  displayPrice: number;
  /** The GST portion of `displayPrice`. Informational only. */
  gstIncluded: number;
  deliveryCharge: number;
  convenienceFee?: number;
  /** 18% service GST on the convenience fee — merged into the fee line. */
  convenienceGst?: number;
  platformFee?: number;
  /** The artwork GST rate in force, as a fraction. Comes from the API quote. */
  gstRate?: number;
  /** "Total" while deciding, "Total paid" on a completed order. */
  totalLabel?: string;
  className?: string;
}

export function PriceBreakdown({
  displayPrice,
  gstIncluded,
  deliveryCharge,
  convenienceFee = 0,
  convenienceGst = 0,
  platformFee = 0,
  gstRate,
  totalLabel = "Total",
  className,
}: PriceBreakdownProps) {
  const paymentProcessing = convenienceFee + convenienceGst;
  const total = displayPrice + deliveryCharge + paymentProcessing + platformFee;

  return (
    <dl
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card px-5 py-4 text-sm",
        className,
      )}
    >
      <Row
        label="Artwork"
        amount={displayPrice}
        subLabel={
          gstRate === undefined
            ? "Price includes GST"
            : `Price includes ${+(gstRate * 100).toFixed(0)}% GST — ${formatINR(gstIncluded)}`
        }
      />

      <Row label="Delivery" amount={deliveryCharge} />

      {platformFee > 0 ? (
        <Row label="Platform fee" amount={platformFee} />
      ) : null}

      <Row
        label="Payment processing"
        amount={paymentProcessing}
        freeWhenZero
        subLabel={convenienceGst > 0 ? "Includes 18% GST" : undefined}
      />

      <div className="mt-3 h-px bg-border" aria-hidden="true" />
      <Row label={totalLabel} amount={total} emphasized />
    </dl>
  );
}

function Row({
  label,
  amount,
  subLabel,
  freeWhenZero,
  emphasized,
}: {
  label: string;
  amount: number;
  subLabel?: string;
  freeWhenZero?: boolean;
  emphasized?: boolean;
}) {
  const free = freeWhenZero && amount === 0;
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        emphasized ? "pt-3" : "py-2",
      )}
    >
      <div className="flex min-w-0 flex-col">
        <dt
          className={cn(
            emphasized
              ? "font-display text-base font-medium text-foreground"
              : "text-foreground/90",
          )}
        >
          {label}
        </dt>
        {subLabel ? (
          <span className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {subLabel}
          </span>
        ) : null}
      </div>
      <dd
        className={cn(
          "shrink-0 tabular-nums",
          free && "font-medium text-emerald-500",
          emphasized
            ? "font-display text-xl font-semibold text-gold-bright"
            : "text-foreground",
        )}
      >
        {free ? "Free" : formatINR(amount)}
      </dd>
    </div>
  );
}
