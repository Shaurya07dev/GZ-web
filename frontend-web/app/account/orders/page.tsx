import type { Metadata } from "next";
import { OrderList } from "@/features/account/order-list";

export const metadata: Metadata = {
  title: "Your Orders — GalleryZone",
};

export default function AccountOrdersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Your orders
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Track every artwork you&rsquo;ve bought on GalleryZone, from
          placement through delivery.
        </p>
      </div>

      <OrderList />
    </div>
  );
}
