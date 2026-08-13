// ---------------------------------------------------------------------------
// PRE-BAKED DEMONSTRATION SERIES — NOT DERIVED FROM ANY ORDER FIXTURE.
//
// Read this before using anything in this file: none of these numbers are
// aggregated from lib/mock-data/customer.ts's mockOrders, from mockArtworks,
// or from any other fixture. Producing meaningful 30d/90d/12m trend charts by
// aggregation would have required hundreds of fabricated order rows, which was
// explicitly rejected (see the admin dashboard design spec §3, "Data
// strategy": the row fixtures stay deliberately modest; the analytics series
// are demonstration data). Do not "fix" a chart by trying to recompute these
// from orders — the orders fixture is a six-row sample of a single customer's
// purchases, not the platform's ledger.
//
// What IS guaranteed, and enforced by the self-checks at the bottom of this
// file, is internal coherence — because four separate tracks render these
// numbers across many charts and tables, and charts that visibly contradict
// each other are worse than no charts at all:
//
//   1. For every RevenuePoint, platform + artist + aggregator === gmv exactly.
//      The split is not invented per point: it is computed by splitRevenue()
//      below from the real documented platform formula (30% markup over the
//      artist's price, of which the aggregator takes 20%) — the same formula
//      lib/mock-data/admin.ts uses for every Settlement, so the revenue chart
//      and the settlements table agree by construction.
//   2. revenueSeries and volumeSeries share identical labels per range, so a
//      revenue chart and a volume chart placed side by side line up on the
//      x-axis.
//   3. categoryPerformance sums EXACTLY to the 12m totals (revenue and
//      orders), so "revenue by category" and "revenue over time" cannot
//      disagree about how much the platform made.
//   4. 30d totals < 90d totals < 12m totals for both revenue and volume.
//   5. artworkFunnel decreases monotonically, and its "Sold" stage is >= the
//      12m order count (you cannot sell fewer artworks than you had orders).
//   6. userGrowthSeries is non-decreasing (it is cumulative, not per-period)
//      and every range ends on the same final point — which is asserted in
//      lib/mock-data/admin.ts to equal the actual per-role counts in
//      mockAdminUsers, so the growth chart's endpoint matches what the People
//      tables actually contain.
//   7. verificationTiers sums to the artist count in mockAdminUsers (also
//      asserted in admin.ts, which is the file that can see both).
//   8. topArtists / topAggregators names resolve to real fixture people
//      (asserted in admin.ts), and their totals never exceed the 12m totals.
//
// All dates are offsets from the same fixed 2026-08-11 anchor every other
// mock-data file uses, never Date.now() — see features/admin/admin-data.ts.
// ---------------------------------------------------------------------------

export type RangeKey = "30d" | "90d" | "12m";

export interface RevenuePoint {
  label: string;
  gmv: number;
  platform: number;
  artist: number;
  aggregator: number;
}
export interface VolumePoint {
  label: string;
  orders: number;
}
export interface CategoryPerformance {
  category: string;
  revenue: number;
  orders: number;
}
export interface FunnelStage {
  stage: string;
  count: number;
}
export interface UserGrowthPoint {
  label: string;
  artists: number;
  aggregators: number;
  customers: number;
}
export interface TierDistribution {
  tier: string;
  count: number;
}
export interface TopPerformer {
  name: string;
  revenue: number;
  count: number;
}

// ---------------------------------------------------------------------------
// Labels — generated from the same fixed anchor as every other fixture file.
// ---------------------------------------------------------------------------

const TODAY = new Date("2026-08-11T00:00:00.000Z");
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(daysAgo: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return `${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]}`;
}

// 30 daily buckets, 13 Jul → 11 Aug 2026.
const DAY_LABELS = Array.from({ length: 30 }, (_, i) => dayLabel(29 - i));

// 13 weekly buckets, week-ending 18 May → 11 Aug 2026 (the last bucket is a
// short week ending on the anchor date).
const WEEK_LABELS = [85, 78, 71, 64, 57, 50, 43, 36, 29, 22, 15, 8, 0].map(dayLabel);

// 12 monthly buckets, Sep 2025 → Aug 2026 (Aug is month-to-date).
const MONTH_LABELS = [
  "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26",
  "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26",
];

// ---------------------------------------------------------------------------
// Revenue. Only GMV is authored per bucket; the three destination components
// are always derived, so they can never fail to add up.
//
// Platform formula (Onboarding Guide / SAD, the same constants that live in
// defaultPlatformSettings): the customer pays the artist's price + 30%. That
// 30% markup is the platform's gross margin, and an aggregator-mediated sale
// gives the aggregator 20% of that markup. Applied to blended GMV this gives
// artist ≈ gmv / 1.3, with the remainder split 80/20 platform/aggregator.
// Rounding is absorbed by `platform` so the three components sum to gmv to
// the rupee.
// ---------------------------------------------------------------------------

function splitRevenue(label: string, gmv: number): RevenuePoint {
  const artist = Math.round(gmv / 1.3);
  const markup = gmv - artist;
  const aggregator = Math.round(markup * 0.2);
  const platform = markup - aggregator;
  return { label, gmv, platform, artist, aggregator };
}

const DAILY_GMV = [
  61200, 32400, 96800, 63500, 58900, 34100, 92600, 66200, 29800, 61700,
  94300, 65100, 33600, 62800, 97400, 64500, 59700, 31900, 95200, 63100,
  32800, 60400, 98100, 66700, 30500, 62300, 58200, 93800, 33200, 61900,
];
const DAILY_ORDERS = [
  2, 1, 3, 2, 2, 1, 3, 2, 1, 2,
  3, 2, 1, 2, 3, 2, 2, 1, 3, 2,
  1, 2, 3, 2, 1, 2, 2, 3, 1, 2,
];

const WEEKLY_GMV = [
  372400, 404600, 341200, 437900, 374100, 407300, 469800,
  436500, 403100, 371800, 342600, 309400, 312100,
];
const WEEKLY_ORDERS = [12, 13, 11, 14, 12, 13, 15, 14, 13, 12, 11, 10, 10];

const MONTHLY_GMV = [
  618400, 742600, 901300, 1162800, 837500, 1001900,
  1240700, 1392400, 1296800, 1624500, 1846900, 731500,
];
const MONTHLY_ORDERS = [22, 26, 31, 38, 29, 34, 41, 45, 43, 52, 58, 24];

export const revenueSeries: Record<RangeKey, RevenuePoint[]> = {
  "30d": DAY_LABELS.map((label, i) => splitRevenue(label, DAILY_GMV[i])),
  "90d": WEEK_LABELS.map((label, i) => splitRevenue(label, WEEKLY_GMV[i])),
  "12m": MONTH_LABELS.map((label, i) => splitRevenue(label, MONTHLY_GMV[i])),
};

export const volumeSeries: Record<RangeKey, VolumePoint[]> = {
  "30d": DAY_LABELS.map((label, i) => ({ label, orders: DAILY_ORDERS[i] })),
  "90d": WEEK_LABELS.map((label, i) => ({ label, orders: WEEKLY_ORDERS[i] })),
  "12m": MONTH_LABELS.map((label, i) => ({ label, orders: MONTHLY_ORDERS[i] })),
};

// ---------------------------------------------------------------------------
// Category performance — the six categories actually present in mockArtworks.
// Totals are tuned to match the 12m revenue and volume totals to the rupee /
// to the order (asserted below), and each category's average order value sits
// in the price band its real fixture artworks occupy.
// ---------------------------------------------------------------------------

export const categoryPerformance: CategoryPerformance[] = [
  { category: "Painting", revenue: 4285000, orders: 141 },
  { category: "Sculpture", revenue: 3612000, orders: 62 },
  { category: "Mixed Media", revenue: 2146000, orders: 43 },
  { category: "Photography", revenue: 1438000, orders: 96 },
  { category: "Printmaking", revenue: 1062000, orders: 62 },
  { category: "Textile Art", revenue: 854300, orders: 39 },
];

// ---------------------------------------------------------------------------
// Artwork lifecycle funnel, all-time. Stage order is the real status
// progression from types/artwork.ts: draft → pending_approval → marketplace →
// reserved → sold → settlement_complete.
// ---------------------------------------------------------------------------

export const artworkFunnel: FunnelStage[] = [
  { stage: "Drafted", count: 1284 },
  { stage: "Submitted", count: 1102 },
  { stage: "On marketplace", count: 947 },
  { stage: "Reserved", count: 612 },
  { stage: "Sold", count: 486 },
  { stage: "Settled", count: 451 },
];

// ---------------------------------------------------------------------------
// User growth — CUMULATIVE totals per role, not new-signups-per-period, so the
// lines only ever climb. Every range ends on the same final point, and that
// final point equals the real per-role counts in mockAdminUsers (asserted in
// lib/mock-data/admin.ts, the only file that can see both).
// ---------------------------------------------------------------------------

const GROWTH_FINAL = { artists: 13, aggregators: 4, customers: 6 };

export const userGrowthSeries: Record<RangeKey, UserGrowthPoint[]> = {
  // The three ranges are three resolutions of one history, so a signup lands
  // in the same calendar week/month in every one of them: the 13th artist and
  // 6th customer both arrive on 3 Aug, the 4th aggregator on 6 Jul.
  "30d": DAY_LABELS.map((label, i) => ({
    label,
    artists: i < 21 ? 12 : 13,
    aggregators: 4,
    customers: i < 21 ? 5 : 6,
  })),
  "90d": WEEK_LABELS.map((label, i) => ({
    label,
    artists: [11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 13, 13][i],
    aggregators: [3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4][i],
    customers: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6][i],
  })),
  "12m": MONTH_LABELS.map((label, i) => ({
    label,
    artists: [4, 5, 6, 7, 8, 9, 9, 10, 11, 12, 12, 13][i],
    aggregators: [1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4][i],
    customers: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6][i],
  })),
};

// ---------------------------------------------------------------------------
// Verification-tier distribution across all 13 artists in mockAdminUsers.
// The seven artists that also exist as public ArtistProfiles resolve to
// Gold 2 / two-tier 3 / one-tier 1 / unverified 1 via verifiedTierCount();
// the six admin-only artists supply the remainder. Sum is asserted against
// the fixture artist count in admin.ts.
// ---------------------------------------------------------------------------

export const verificationTiers: TierDistribution[] = [
  { tier: "Gold (3 tiers)", count: 2 },
  { tier: "2 tiers", count: 4 },
  { tier: "1 tier", count: 3 },
  { tier: "Unverified", count: 4 },
];

// ---------------------------------------------------------------------------
// Top performers, trailing 12 months. Names resolve to real fixture people
// (artist names in mockArtists, aggregator companyNames in mockAdminUsers) —
// asserted in admin.ts. `revenue` is GMV attributed to that seller, so these
// are subsets of the 12m GMV total, never equal to it.
// ---------------------------------------------------------------------------

export const topArtists: TopPerformer[] = [
  { name: "Meera Nair", revenue: 2184000, count: 68 },
  { name: "Arjun Mehta", revenue: 1896000, count: 34 },
  { name: "Ishaan Kapoor", revenue: 1342000, count: 41 },
  { name: "Priya Subramaniam", revenue: 1128000, count: 24 },
  { name: "Rohan Bhattacharya", revenue: 742000, count: 47 },
];

export const topAggregators: TopPerformer[] = [
  { name: "Verandah Art House", revenue: 1642000, count: 52 },
  { name: "Kala Collective", revenue: 1218000, count: 39 },
  { name: "Fort Kochi Art Rooms", revenue: 864000, count: 28 },
  { name: "Baithak Gallery", revenue: 612000, count: 21 },
];

// ---------------------------------------------------------------------------
// Self-checks — fail fast at import time rather than let four tracks render
// numbers that quietly contradict each other. Same idiom as
// lib/mock-data/aggregator-holdings.ts.
// ---------------------------------------------------------------------------

const RANGES: RangeKey[] = ["30d", "90d", "12m"];

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function totalGmv(range: RangeKey): number {
  return sum(revenueSeries[range].map((point) => point.gmv));
}
export function totalOrders(range: RangeKey): number {
  return sum(volumeSeries[range].map((point) => point.orders));
}

for (const range of RANGES) {
  const revenue = revenueSeries[range];
  const volume = volumeSeries[range];

  if (revenue.length !== volume.length) {
    throw new Error(`admin-analytics: "${range}" revenue/volume series lengths differ`);
  }

  revenue.forEach((point, i) => {
    if (point.platform + point.artist + point.aggregator !== point.gmv) {
      throw new Error(
        `admin-analytics: "${range}" point "${point.label}" components do not sum to gmv`
      );
    }
    if (point.label !== volume[i].label) {
      throw new Error(`admin-analytics: "${range}" revenue/volume labels differ at index ${i}`);
    }
    if (volume[i].orders === 0 && point.gmv !== 0) {
      throw new Error(`admin-analytics: "${range}" point "${point.label}" has revenue but no orders`);
    }
  });

  const growth = userGrowthSeries[range];
  if (growth.length !== revenue.length) {
    throw new Error(`admin-analytics: "${range}" growth series length differs from revenue series`);
  }
  growth.forEach((point, i) => {
    const previous = growth[i - 1];
    if (
      previous &&
      (point.artists < previous.artists ||
        point.aggregators < previous.aggregators ||
        point.customers < previous.customers)
    ) {
      throw new Error(`admin-analytics: "${range}" cumulative user growth decreases at "${point.label}"`);
    }
  });
  const last = growth[growth.length - 1];
  if (
    last.artists !== GROWTH_FINAL.artists ||
    last.aggregators !== GROWTH_FINAL.aggregators ||
    last.customers !== GROWTH_FINAL.customers
  ) {
    throw new Error(`admin-analytics: "${range}" user growth does not end on the shared final point`);
  }
}

if (!(totalGmv("30d") < totalGmv("90d") && totalGmv("90d") < totalGmv("12m"))) {
  throw new Error("admin-analytics: range GMV totals are not 30d < 90d < 12m");
}
if (!(totalOrders("30d") < totalOrders("90d") && totalOrders("90d") < totalOrders("12m"))) {
  throw new Error("admin-analytics: range order totals are not 30d < 90d < 12m");
}

if (sum(categoryPerformance.map((c) => c.revenue)) !== totalGmv("12m")) {
  throw new Error("admin-analytics: categoryPerformance revenue does not sum to the 12m GMV total");
}
if (sum(categoryPerformance.map((c) => c.orders)) !== totalOrders("12m")) {
  throw new Error("admin-analytics: categoryPerformance orders do not sum to the 12m order total");
}

artworkFunnel.forEach((stage, i) => {
  const previous = artworkFunnel[i - 1];
  if (previous && stage.count > previous.count) {
    throw new Error(`admin-analytics: funnel stage "${stage.stage}" exceeds "${previous.stage}"`);
  }
});
const soldStage = artworkFunnel.find((stage) => stage.stage === "Sold");
if (!soldStage || soldStage.count < totalOrders("12m")) {
  throw new Error("admin-analytics: funnel 'Sold' count is below the 12m order total");
}

for (const [label, performers] of [
  ["topArtists", topArtists],
  ["topAggregators", topAggregators],
] as const) {
  if (sum(performers.map((p) => p.revenue)) > totalGmv("12m")) {
    throw new Error(`admin-analytics: ${label} revenue exceeds the 12m GMV total`);
  }
  if (sum(performers.map((p) => p.count)) > totalOrders("12m")) {
    throw new Error(`admin-analytics: ${label} sale counts exceed the 12m order total`);
  }
}
