import type { Metadata } from "next";
import { SettlementsTable } from "@/features/aggregator/settlements-table";

export const metadata: Metadata = {
  title: "Settlements | GalleryZone Aggregator Portal",
};

export default function AggregatorSettlementsPage() {
  return <SettlementsTable />;
}
