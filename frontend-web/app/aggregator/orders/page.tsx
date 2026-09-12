import type { Metadata } from "next";
import { SalesTable } from "@/features/aggregator/sales-table";

export const metadata: Metadata = {
  title: "Orders & Sales | GalleryZone Aggregator Portal",
};

export default function AggregatorOrdersPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          Orders & Sales
        </h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground sm:text-sm">
          Track sales, reservations and returns for the artworks in your collection.
        </p>
      </div>
      <SalesTable />
    </div>
  );
}
