import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { orderService } from "@/services/orderService";
import { customerService } from "@/services/customerService";
import { getArtworkById } from "@/lib/mock-data/helpers";
import { PriceTag } from "@/components/shared/price-tag";
import { OrderStatusTimeline } from "@/features/account/order-status-timeline";
import { OrderPriceBreakdown } from "@/features/account/order-price-breakdown";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export async function generateMetadata(
  props: PageProps<"/account/orders/[orderId]">,
): Promise<Metadata> {
  const { orderId } = await props.params;
  const order = await orderService.get(orderId);

  if (!order) {
    return { title: "Order not found | GalleryZone" };
  }

  const artwork = getArtworkById(order.artworkId);
  return {
    title: artwork
      ? `Order | ${artwork.title} | GalleryZone`
      : "Order | GalleryZone",
  };
}

// Async Server Component: orderService/customerService are just Promise-
// wrapped mock lookups (no real network), so this looks up the order,
// resolves its artwork (lib/mock-data/helpers) and its delivery address
// (customerService.listAddresses, matched by order.addressId) all
// server-side, then hands static, already-resolved data down to the
// OrderStatusTimeline/OrderPriceBreakdown presentational components. An
// unknown orderId 404s via notFound() rather than rendering a broken page.
export default async function OrderDetailPage(
  props: PageProps<"/account/orders/[orderId]">,
) {
  const { orderId } = await props.params;
  const order = await orderService.get(orderId);

  if (!order) {
    notFound();
  }

  const artwork = getArtworkById(order.artworkId);
  const addresses = await customerService.listAddresses();
  const address = addresses.find((a) => a.id === order.addressId);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-gold-bright"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          Back to orders
        </Link>
        <h2 className="mt-3 font-display text-xl font-semibold text-foreground">
          Order #{order.id.slice(-8)}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Placed on {formatDate(order.createdAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
              {artwork && (
                <Image
                  src={artwork.thumbnailUrl}
                  alt={artwork.title}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-foreground">
                {artwork?.title ?? "Artwork no longer available"}
              </p>
              {artwork && (
                <p className="truncate text-sm text-muted-foreground">
                  {artwork.artistName}
                </p>
              )}
              <PriceTag amount={order.amount} className="mt-1.5 text-sm" />
            </div>
          </div>

          <OrderStatusTimeline history={order.statusHistory} />
        </div>

        <div className="flex flex-col gap-8">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Delivery address
            </h2>
            {address ? (
              <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                <p className="text-foreground">{address.line1}</p>
                {address.line2 && <p>{address.line2}</p>}
                <p>
                  {address.city}, {address.state} {address.pincode}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                This address is no longer on file.
              </p>
            )}
          </div>

          <OrderPriceBreakdown
            amount={order.amount}
            gstAmount={order.gstAmount}
            deliveryCharge={order.deliveryCharge}
          />
        </div>
      </div>
    </div>
  );
}
