import type { Metadata } from "next";
import { OrderDetailView } from "@/features/account/order-detail-view";

// Orders are private to the signed-in customer and the API needs their
// Firebase ID token, which only the browser holds — so the page is a thin
// Server Component shell and the order itself is fetched client-side in
// OrderDetailView (useOrder/useArtwork/useAddresses). Metadata can't name
// the artwork for the same reason.
export const metadata: Metadata = {
  title: "Order | GalleryZone",
};

export default async function OrderDetailPage(
  props: PageProps<"/account/orders/[orderId]">,
) {
  const { orderId } = await props.params;
  return <OrderDetailView orderId={orderId} />;
}
