import { PlayCircle } from "lucide-react";
import { OrdersTable } from "@/features/dashboard/orders-table";

export const metadata = {
  title: "Orders | GalleryZone Artist Dashboard",
};

export default function ArtistOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Orders
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Track which of your pieces have sold and their fulfillment status.
        </p>
      </div>

      {/* Same dashed placeholder pattern as the aggregator explainer video —
          drop the embed in here once it exists. */}
      <div className="flex items-center gap-3 rounded-md border border-dashed border-gold/40 px-3.5 py-3">
        <PlayCircle
          className="size-5 shrink-0 text-gold-bright"
          strokeWidth={1.5}
        />
        <div>
          <p className="text-xs font-medium text-foreground">
            Explainer video
          </p>
          <p className="text-[11px] text-muted-foreground">
            A short walkthrough of the aggregator process goes here: how to
            sign the artwork, how to pack it, and what to include in the
            packaging. Coming soon.
          </p>
        </div>
      </div>

      <OrdersTable />
    </div>
  );
}
