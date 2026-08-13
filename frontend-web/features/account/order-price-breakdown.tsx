import { cn, formatINR } from "@/lib/utils";

// amount/gstAmount/deliveryCharge are already-computed values sitting on the
// Order record (see types/order.ts, orderService.create) -- this component
// only sums and displays them via formatINR, it never recomputes the GST/
// delivery math itself (that math's single source of truth is
// services/orderService.ts's CHECKOUT_GST_RATE/CHECKOUT_DELIVERY_CHARGE,
// consumed by the Checkout track, not duplicated here).
interface OrderPriceBreakdownProps {
  amount: number;
  gstAmount: number;
  deliveryCharge: number;
}

export function OrderPriceBreakdown({
  amount,
  gstAmount,
  deliveryCharge,
}: OrderPriceBreakdownProps) {
  const total = amount + gstAmount + deliveryCharge;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground">
        Price breakdown
      </h2>
      <dl className="mt-4 flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4 text-sm">
        <Row label="Artwork price" amount={amount} />
        <Row label="GST" amount={gstAmount} />
        <Row label="Delivery" amount={deliveryCharge} />
        <div className="my-1 h-px bg-border" aria-hidden="true" />
        <Row label="Total paid" amount={total} emphasized />
      </dl>
    </div>
  );
}

function Row({
  label,
  amount,
  emphasized,
}: {
  label: string;
  amount: number;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={cn("text-muted-foreground", emphasized && "font-medium text-foreground")}>
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums text-foreground",
          emphasized && "font-display text-base font-semibold"
        )}
      >
        {formatINR(amount)}
      </dd>
    </div>
  );
}
