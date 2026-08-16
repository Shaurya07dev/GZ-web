import type { Metadata } from "next";
import { AggregatorSupportView } from "@/features/aggregator/support-view";

export const metadata: Metadata = {
  title: "Support | GalleryZone Aggregator Portal",
};

export default function AggregatorSupportPage() {
  return <AggregatorSupportView />;
}
