"use client";

import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { AdminKpiGrid } from "@/features/admin/overview/admin-kpi-grid";
import { AdminActivityFeed } from "@/features/admin/overview/admin-activity-feed";
import { AdminRevenueOverview } from "@/features/admin/overview/admin-revenue-overview";

export default function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Overview"
        description="Platform health, and whatever is waiting on you."
      />

      <AdminKpiGrid />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <AdminRevenueOverview />
        <AdminActivityFeed />
      </div>
    </div>
  );
}
