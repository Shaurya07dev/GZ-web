"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { notFound } from "next/navigation";
import { useOrder } from "@/hooks/useOrders";
import { useArtwork } from "@/hooks/useArtwork";
import { useAddresses } from "@/hooks/useAddresses";
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

// Client-fetched: orders and addresses are the signed-in customer's own,
// and the API call needs their Firebase ID token, which only exists in
// the browser (lib/api.ts). The page shell stays a Server Component for
// metadata; everything below the fold resolves through the hooks.
export function OrderDetailView({ orderId }: { orderId: string }) {
  const orderQuery = useOrder(orderId);
  const order = orderQuery.data;
  const artworkQuery = useArtwork(order?.artworkId ?? "");
  const addressesQuery = useAddresses();

  if (orderQuery.isPending) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading order…
      </div>
    );
  }
  if (orderQuery.isError) {
    return (
      <p className="py-16 text-sm text-destructive">
        {orderQuery.error instanceof Error
          ? orderQuery.error.message
          : "Couldn't load this order."}
      </p>
    );
  }
  if (!order) notFound();

  const artwork = artworkQuery.data;
  const address = addressesQuery.data?.find((a) => a.id === order.addressId);

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
                {artwork?.title ??
                  (artworkQuery.isPending ? "Loading…" : "Artwork no longer available")}
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
                {addressesQuery.isPending
                  ? "Loading address…"
                  : "This address is no longer on file."}
              </p>
            )}
          </div>

          <OrderPriceBreakdown
            amount={order.amount}
            gstAmount={order.gstAmount}
            deliveryCharge={order.deliveryCharge}
            convenienceFee={order.convenienceFee}
            convenienceGst={order.convenienceGst}
          />
        </div>
      </div>
    </div>
  );
}
