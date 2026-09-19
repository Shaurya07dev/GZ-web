import { cn, formatINR } from "@/lib/utils";

// The one price breakdown, used by both checkout steps and the receipt on a
// past order. It was three near-identical copies, and the drift they were
// warned about happened the moment GST moved inside the displayed price.
//
// The rule this component exists to hold: GST is ALREADY part of `displayPrice`.
// It is shown so the buyer can see the tax component, and it is never added to
// the total. Only delivery and the convenience fee are additions.

export interface PriceBreakdownProps {
  /** The artwork's listed price, GST included. */
  displayPrice: number;
  /** The GST portion of `displayPrice`. Informational only. */
  gstIncluded: number;
  deliveryCharge: number;
  convenienceFee?: number;
  /** 18% service GST on the convenience fee — shown only when that fee exists. */
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
  const total = displayPrice + deliveryCharge + convenienceFee + convenienceGst + platformFee;

  return (
    <dl
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4 text-sm",
        className,
      )}
    >
      <Row label="Artwork price" amount={displayPrice} />
      <div className="-mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <dt>Includes GST{gstRate === undefined ? "" : ` (${+(gstRate * 100).toFixed(2)}%)`}</dt>
        <dd className="tabular-nums">{formatINR(gstIncluded)}</dd>
      </div>
      <Row label="Platform fee" amount={platformFee} freeWhenZero />
      <Row label="Convenience fee" amount={convenienceFee} freeWhenZero />
      {convenienceGst > 0 && (
        <div className="-mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <dt>GST on convenience fee (18%)</dt>
          <dd className="tabular-nums">{formatINR(convenienceGst)}</dd>
        </div>
      )}
      <Row label="Delivery" amount={deliveryCharge} />
      <div className="my-0.5 h-px bg-border" aria-hidden="true" />
      <Row label={totalLabel} amount={total} emphasized />
    </dl>
  );
}

function Row({
  label,
  amount,
  freeWhenZero,
  emphasized,
}: {
  label: string;
  amount: number;
  freeWhenZero?: boolean;
  emphasized?: boolean;
}) {
  const free = freeWhenZero && amount === 0;
  return (
    <div className="flex items-center justify-between">
      <dt
        className={cn(
          "text-muted-foreground",
          emphasized && "font-medium text-foreground",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums text-foreground",
          free && "font-medium text-emerald-500",
          emphasized &&
            "font-display text-lg font-semibold text-gold-bright",
        )}
      >
        {free ? "Free" : formatINR(amount)}
      </dd>
    </div>
  );
}
