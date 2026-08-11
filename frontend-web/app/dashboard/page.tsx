import type { Metadata } from "next";
import { KpiCards } from "@/features/dashboard/kpi-cards";
import { VerificationProgress } from "@/features/dashboard/verification-progress";
import { RecentActivityFeed } from "@/features/dashboard/recent-activity-feed";
import { RevenueChart } from "@/features/dashboard/revenue-chart";

export const metadata: Metadata = {
  title: "Dashboard — GalleryZone",
};

export default function DashboardOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <KpiCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <RevenueChart />
        <VerificationProgress />
      </div>

      <RecentActivityFeed />
    </div>
  );
}
