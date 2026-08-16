import type { Metadata } from "next";
import { CustomersTable } from "@/features/aggregator/customers-table";

export const metadata: Metadata = {
  title: "Customers | GalleryZone Aggregator Portal",
};

export default function AggregatorCustomersPage() {
  return <CustomersTable />;
}
