import { PriceBreakdown } from "@/components/shared/price-breakdown";
import type { OrderStatus } from "@/types/order";

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
  convenienceFee?: number;
  convenienceGst?: number;
  /** The order's lifecycle status. Governs whether the total is labelled
   *  "Total paid" (money moved) or "Order total" (still pending/cancelled).
   *  Reported 5 Nov 2026: a pending order said "Total paid" even though the
   *  invoice box one line above said "An invoice is issued once your
   *  payment is confirmed". Two contradictory claims on the same screen. */
  status?: OrderStatus;
}

export function OrderPriceBreakdown({
  amount,
  gstAmount,
  deliveryCharge,
  convenienceFee = 0,
  convenienceGst = 0,
  status,
}: OrderPriceBreakdownProps) {
  const hasPaid = status !== undefined && status !== "pending" && status !== "cancelled";
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
        convenienceFee={convenienceFee}
        convenienceGst={convenienceGst}
        totalLabel={hasPaid ? "Total paid" : "Order total"}
      />
    </div>
  );
}
