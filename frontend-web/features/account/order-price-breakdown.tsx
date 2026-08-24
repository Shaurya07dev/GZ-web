import { PriceBreakdown } from "@/components/shared/price-breakdown";

// The receipt on a past order. amount/gstAmount/deliveryCharge are the values
// frozen onto the Order record when it was placed (see types/order.ts), so a
// later change to the GST rate or the delivery charge never rewrites history —
// this shows what was actually charged, not what would be charged today.
//
// `amount` is the artwork's listed price with GST already inside it, and
// `gstAmount` is the portion of that price which was tax. Adding the two
// together would charge the buyer for GST twice, which is why the sum lives in
// PriceBreakdown and not here.
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
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground">
        Price breakdown
      </h2>
      <PriceBreakdown
        className="mt-4"
        displayPrice={amount}
        gstIncluded={gstAmount}
        deliveryCharge={deliveryCharge}
        totalLabel="Total paid"
      />
    </div>
  );
}
