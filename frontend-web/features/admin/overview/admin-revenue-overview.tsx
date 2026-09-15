"use client";

import { RevenueAreaChart } from "@/features/admin/charts/revenue-area-chart";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";

export function AdminRevenueOverview() {
  const { revenue } = useAdminAnalytics("30d");
  return <RevenueAreaChart data={revenue} description="Last 30 days, split by where each rupee lands." />;
}
