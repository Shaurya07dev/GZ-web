import type { Metadata } from "next";
import { CollectionBoard } from "@/features/account/collection-board";

export const metadata: Metadata = {
  title: "My Collection | GalleryZone",
};

export default function AccountCollectionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          My Collection
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every artwork you own, with its certificate, provenance, and
          ownership record.
        </p>
      </div>

      <CollectionBoard />
    </div>
  );
}
