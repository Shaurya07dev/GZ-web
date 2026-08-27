import type { Metadata } from "next";
import { CollectionTable } from "@/features/aggregator/collection-table";

export const metadata: Metadata = {
  title: "My Inventory | GalleryZone Aggregator Portal",
};

export default function AggregatorCollectionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          My Inventory
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The pieces you are displaying. Record a sale here, or return one you
          no longer want to hold.
        </p>
      </div>

      <CollectionTable />
    </div>
  );
}
