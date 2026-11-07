"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import { notFound } from "next/navigation";
import { useOrder } from "@/hooks/useOrders";
import { useArtwork } from "@/hooks/useArtwork";
import { useAddresses } from "@/hooks/useAddresses";
import { PriceTag } from "@/components/shared/price-tag";
import { ShipmentTracker } from "@/components/shared/shipment-tracker";
import { OrderStatusTimeline } from "@/features/account/order-status-timeline";
import { OrderPriceBreakdown } from "@/features/account/order-price-breakdown";
import { DownloadInvoiceButton } from "@/components/shared/download-invoice-button";
import { RequestRefundDialog } from "@/features/account/request-refund-dialog";
import { Button } from "@/components/ui/button";
import { orderService } from "@/services/orderService";
import { PaymentDismissedError } from "@/lib/razorpay-checkout";
import type { Order } from "@/types/order";
import { formatINR } from "@/lib/utils";

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
              <PriceTag amount={order.amount} className="mt-1.5 text-sm" showGstNote />
            </div>
          </div>

          <OrderStatusTimeline history={order.statusHistory} />

          {/* The ShipRocket tracker sits with the order timeline — the
              timeline shows what WE know about the order, the tracker shows
              what the courier is doing right now. */}
          {(order.shiprocketStage || order.status === "transit" || order.status === "packed") && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-display text-sm font-semibold text-foreground">
                Shipment
              </h3>
              <div className="mt-3">
                <ShipmentTracker
                  stage={order.shiprocketStage ?? null}
                  trackingId={order.trackingId}
                  carrier={order.carrier}
                />
              </div>
            </div>
          )}
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
            status={order.status}
          />

          {/* A pending order is a stranded order unless we offer a way
            * forward. Live QA (5 Nov 2026) caught: a buyer who dismissed
            * Razorpay could see the order but had no button to retry, and
            * no path to cancel it either. Offer "Complete payment" that
            * re-opens the same Razorpay session, plus a note on how to
            * cancel. */}
          {order.status === "pending" && (
            <PendingOrderActions order={order} />
          )}

          {/* Audit §9: tax invoice is only valid once the order is paid. */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Tax invoice
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {order.status === "pending" || order.status === "cancelled"
                  ? "An invoice is issued once your payment is confirmed."
                  : "GST-compliant tax invoice for this order."}
              </p>
            </div>
            <DownloadInvoiceButton
              orderId={order.id}
              disabled={
                order.status === "pending" || order.status === "cancelled"
              }
              disabledReason="Invoice available once your payment is confirmed"
            />
          </div>

          {order.status !== "pending" && order.status !== "cancelled" && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
              <h3 className="font-display text-sm font-semibold text-foreground">
                Something wrong?
              </h3>
              <p className="text-xs text-muted-foreground">
                Request a refund and support will take a look. Keep the
                artwork for now — don&rsquo;t return anything until support
                replies.
              </p>
              <div className="mt-1">
                <RequestRefundDialog
                  orderId={order.id}
                  artworkTitle={artwork?.title ?? "Artwork"}
                  totalLabel={formatINR(
                    order.amount +
                      order.gstAmount +
                      order.deliveryCharge +
                      order.convenienceFee +
                      order.convenienceGst,
                  )}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The "you started an order, didn't pay, now what?" box.
 *
 * Shown on every pending order. "Complete payment" re-opens Razorpay on
 * the SAME order id — no duplicate order is created (and the backend
 * dedup catches it anyway). Cancellation is a support request today, not
 * a button, because a self-service cancel endpoint would need to reason
 * about (webhook arrived first), (refund if money moved), (artwork
 * returns to marketplace) all at once, and getting that wrong in a rush
 * is worse than a one-day email round-trip.
 */
function PendingOrderActions({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const total = order.amount + order.deliveryCharge + order.convenienceFee + order.convenienceGst;

  async function resumePayment() {
    setBusy(true);
    try {
      await orderService.resumePayment(order.id);
      toast.success("Payment received — thank you.");
      queryClient.invalidateQueries({ queryKey: ["order", order.id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["artworks"] });
    } catch (error) {
      if (error instanceof PaymentDismissedError) {
        toast.info("Payment cancelled — nothing was charged. You can try again any time.");
        return;
      }
      toast.error(error instanceof Error ? error.message : "Could not complete the payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gold/40 bg-gold/5 p-4">
      <div>
        <h3 className="font-display text-sm font-semibold text-foreground">
          Finish paying for this order
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Your payment never went through. Tap below to re-open the secure
          Razorpay checkout — nothing is charged until you confirm. The
          artwork is held for you while this order is pending.
        </p>
      </div>
      <Button onClick={resumePayment} disabled={busy} className="self-start">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
        {busy ? "Opening checkout…" : `Complete payment · ${formatINR(total)}`}
      </Button>
      <p className="text-xs text-muted-foreground">
        Changed your mind? Email{" "}
        <a
          href="mailto:support@galleryzone.in"
          className="text-gold-bright underline-offset-2 hover:underline"
        >
          support@galleryzone.in
        </a>{" "}
        with order <span className="font-mono">{order.id}</span> and
        we&rsquo;ll cancel it for you.
      </p>
    </div>
  );
}
