import type { Metadata } from "next";
import { ShippingTable } from "@/features/aggregator/shipping-table";

export const metadata: Metadata = {
  title: "Shipping & Logistics | GalleryZone Aggregator Portal",
};

export default function AggregatorShippingPage() {
  return <ShippingTable />;
}
