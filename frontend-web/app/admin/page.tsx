"use client";

import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { AdminKpiGrid } from "@/features/admin/overview/admin-kpi-grid";
import { AdminActivityFeed } from "@/features/admin/overview/admin-activity-feed";
import { RevenueAreaChart } from "@/features/admin/charts/revenue-area-chart";
import { revenueSeries } from "@/lib/mock-data/admin-analytics";

export default function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Overview"
        description="Platform health, and whatever is waiting on you."
      />

      <AdminKpiGrid />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <RevenueAreaChart
          data={revenueSeries["30d"]}
          description="Last 30 days, split by where each rupee lands."
        />
        <AdminActivityFeed />
      </div>
    </div>
  );
}
