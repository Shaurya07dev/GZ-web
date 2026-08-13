import type { Metadata } from "next";
import { ReservableInventoryGrid } from "@/features/aggregator/reservable-inventory-grid";

export const metadata: Metadata = {
  title: "Inventory | GalleryZone Aggregator Portal",
};

export default function AggregatorInventoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Reservable inventory
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse artworks available for aggregator display. Reserving pays the
          advance and moves a piece into your Collection.
        </p>
      </div>

      <ReservableInventoryGrid />
    </div>
  );
}
