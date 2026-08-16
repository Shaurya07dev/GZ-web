import type { Metadata } from "next";
import { AggregatorSettingsView } from "@/features/aggregator/settings-view";

export const metadata: Metadata = {
  title: "Settings | GalleryZone Aggregator Portal",
};

export default function AggregatorSettingsPage() {
  return <AggregatorSettingsView />;
}
