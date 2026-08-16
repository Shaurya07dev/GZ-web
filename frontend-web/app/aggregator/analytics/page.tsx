import type { Metadata } from "next";
import { AnalyticsView } from "@/features/aggregator/analytics-view";

export const metadata: Metadata = {
  title: "Analytics | GalleryZone Aggregator Portal",
};

export default function AggregatorAnalyticsPage() {
  return <AnalyticsView />;
}
