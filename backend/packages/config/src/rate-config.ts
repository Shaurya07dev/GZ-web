// The "nothing hardcoded" seam described in the plan's Admin rules console
// section. packages/domain's pricing functions take a PricingRates object;
// this module is the only place that resolves one — either from the
// versioned `rate_config` table (via the store passed in) or, only when no
// store is given (local dev / unit tests), the literal seed values.
//
// Application code (apps/api, apps/jobs) must always go through
// loadActiveRates() with a real RateConfigStore — never import
// DEFAULT_RATE_SEED directly for a business calculation.

import { DEFAULT_RATE_SEED, type PricingRates } from "@galleryzone/domain";

export interface RateConfigVersion {
  id: string;
  effectiveFrom: Date;
  rates: PricingRates;
  approvedBy: string;
  reason: string;
}

/**
 * Implemented by packages/db against the `rate_config` table (Phase 0/1).
 * Kept as an interface here so packages/config has zero dependency on the
 * database driver — this package only knows how to ask for the active
 * version, not how one is stored.
 */
export interface RateConfigStore {
  /** The version whose effectiveFrom is the latest one at or before `asOf`. */
  getActiveVersion(asOf: Date): Promise<RateConfigVersion | null>;
}

/**
 * Resolves the rates a pricing calculation should use right now (or as of a
 * past instant, for replaying/settling an older transaction against the
 * rate that was live when it happened). Falls back to DEFAULT_RATE_SEED
 * only when no store is configured or no version has been written yet —
 * i.e. before the first migration's seed row exists.
 */
export async function loadActiveRates(
  store: RateConfigStore | null,
  asOf: Date = new Date(),
): Promise<PricingRates> {
  if (!store) return DEFAULT_RATE_SEED;
  const active = await store.getActiveVersion(asOf);
  return active?.rates ?? DEFAULT_RATE_SEED;
}
