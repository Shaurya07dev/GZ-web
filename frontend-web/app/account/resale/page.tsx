import type { Metadata } from "next";
import { ResaleView } from "@/features/account/resale-view";

export const metadata: Metadata = {
  title: "Resale | GalleryZone",
};

export default function AccountResalePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Resale
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          List an artwork from your collection back on GalleryZone.
        </p>
      </div>

      <ResaleView />
    </div>
  );
}
