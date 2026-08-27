import type { Metadata } from "next";
import { AggregatorKpiCards } from "@/features/aggregator/aggregator-kpi-cards";
import { CommissionExplainer } from "@/features/aggregator/commission-explainer";
import { SalesConversionCard } from "@/features/aggregator/sales-conversion-card";
import { AggregatorActivityFeed } from "@/features/aggregator/aggregator-activity-feed";

export const metadata: Metadata = {
  title: "Dashboard | GalleryZone Aggregator Portal",
};

export default function AggregatorDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <AggregatorKpiCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <AggregatorActivityFeed />
        <div className="flex flex-col gap-6">
          <CommissionExplainer />
          <SalesConversionCard />
        </div>
      </div>
    </div>
  );
}
