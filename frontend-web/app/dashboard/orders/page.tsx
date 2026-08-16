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
      <OrdersTable />
    </div>
  );
}
