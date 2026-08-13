import type { Metadata } from "next";
import { CollectionTable } from "@/features/aggregator/collection-table";

export const metadata: Metadata = {
  title: "Collection — GalleryZone Aggregator Portal",
};

export default function AggregatorCollectionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Your collection
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage display pricing and record sales for artworks you&rsquo;ve
          reserved.
        </p>
      </div>

      <CollectionTable />
    </div>
  );
}
