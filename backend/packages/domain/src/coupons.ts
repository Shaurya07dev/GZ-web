// Pure discount math — kept in domain so the settlement balance check and
// the DB layer both agree on the number without a Firestore round-trip.
//
// A coupon's discount has two possible shapes:
//
//   percent — value is the percent (0-100). Discount = round(subtotal × value/100).
//             If maxDiscountPaise is set the discount is clamped there.
//
//   flat    — value IS the discount, in paise. maxDiscountPaise is ignored
//             (makes no sense to cap a flat value by anything other than
//             the subtotal itself).
//
// Both shapes also clamp to the subtotal — never discount more than the
// customer was going to pay — and round to whole paise.

export interface CouponInput {
  kind: "percent" | "flat";
  /** Percent (0-100) when `kind === "percent"`; paise when `kind === "flat"`. */
  value: number;
  /** Ceiling for percent coupons. Paise. Ignored for flat. Null = no cap. */
  maxDiscountPaise: number | null;
}

export function computeCouponDiscount(input: { coupon: CouponInput; subtotalPaise: number }): number {
  const { coupon, subtotalPaise } = input;
  if (subtotalPaise <= 0) return 0;
  const raw =
    coupon.kind === "percent"
      ? Math.round((subtotalPaise * Math.max(0, coupon.value)) / 100)
      : Math.max(0, Math.round(coupon.value));
  const capped =
    coupon.kind === "percent" && coupon.maxDiscountPaise !== null
      ? Math.min(raw, coupon.maxDiscountPaise)
      : raw;
  return Math.min(capped, subtotalPaise);
}
