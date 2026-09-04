// Zod schema mirroring packages/domain's PricingRates. This is what the
// admin rules console's "propose a rate change" endpoint validates a
// request body against before it's allowed anywhere near rate_config —
// reject-unknown-keys, and hard bounds per rate (plan.md §14 / the plan's
// Admin rules console section: "a typo can't zero out GalleryZone's margin
// or push a rate over 100%").
//
// Requires `zod` (added once `npm install` runs with network access).
// Bounds below are a starting point, not final numbers — they need the
// same client sign-off as the rates themselves before Phase 1 enforces
// them for real.

import { z } from "zod";

const percent = (max: number) => z.number().min(0).max(max);

export const deliveryZoneRateSchema = z
  .object({
    base: z.number().int().min(0),
    perExtraKg: z.number().int().min(0),
  })
  .strict();

export const pricingRatesSchema = z
  .object({
    gstRate: percent(0.28), // GST slabs in India top out at 28%
    platformMarkup: percent(2), // 200% ceiling — a sanity bound, not a target
    artistListingFeeRate: percent(0.2),
    aggregatorAdvanceRate: percent(0.5),
    aggregatorCommissionRate: percent(0.5),
    artistConvenienceRate: percent(0.2),
    customerConvenienceFee: z.number().int().min(0),
    deliveryCharge: z.number().int().min(0),
    artistPayoutDaysAfterDelivery: z.number().int().min(0).max(90),
    aggregatorCycleMonths: z.number().int().min(1).max(24),
    aggregatorListingDays: z.number().int().min(1).max(730),
    aggregatorPlacementDays: z.number().int().min(1).max(365),
    aggregatorMonthlyDiscountRates: z.array(percent(1)).min(1),
    deliveryZoneRates: z
      .object({
        local: deliveryZoneRateSchema,
        regional: deliveryZoneRateSchema,
        metro: deliveryZoneRateSchema,
        national: deliveryZoneRateSchema,
        remote: deliveryZoneRateSchema,
      })
      .strict(),
    deliveryBaseSlabKg: z.number().min(0),
    remotePincodePrefixes: z.array(z.string().length(2)),
  })
  .strict();

export const proposeRateChangeSchema = z
  .object({
    rates: pricingRatesSchema,
    effectiveFrom: z.string().datetime(),
    reason: z.string().min(10, "a real reason, not a placeholder"),
  })
  .strict();

export type ProposeRateChangeInput = z.infer<typeof proposeRateChangeSchema>;
