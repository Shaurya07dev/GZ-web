// Series shapes for the admin analytics charts (hooks/useAdminAnalytics).

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
