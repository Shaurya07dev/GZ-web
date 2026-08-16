import type { Metadata } from "next";
import { SalesTable } from "@/features/aggregator/sales-table";

export const metadata: Metadata = {
  title: "Orders & Sales | GalleryZone Aggregator Portal",
};

export default function AggregatorOrdersPage() {
  return <SalesTable />;
}
