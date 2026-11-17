import type { Metadata } from "next";
import { InventoryBrowser } from "@/features/aggregator/inventory-browser";

export const metadata: Metadata = {
  title: "Browse GalleryZone | Aggregator Portal",
};

export default function AggregatorInventoryPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          Browse GalleryZone
        </h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground sm:text-sm">
          Browse artworks available for aggregator display.<br className="hidden sm:block" />
          Reserving pays the advance and moves a piece into your Collection.
        </p>
      </div>

      <InventoryBrowser />
    </div>
  );
}
