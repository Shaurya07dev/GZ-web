"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { useCreateOrderMutation } from "@/hooks/useOrders";
import {
  CHECKOUT_DELIVERY_CHARGE,
  CHECKOUT_GST_RATE,
} from "@/services/orderService";
import { RazorpaySimulation } from "./razorpay-simulation";
import type { Artwork } from "@/types/artwork";
import type { Address } from "@/types/customer";
import type { Order } from "@/types/order";

interface CheckoutConfirmStepProps {
  artwork: Artwork;
  address: Address;
  onBack: () => void;
  onOrderPlaced: (order: Order) => void;
  placedOrder: Order | null;
}

// Step 3 of checkout: a single "Place Order" action against
// useCreateOrderMutation. There is no simulated-conflict/error toggle here
// (unlike e.g. the Aggregator reserve flow) because checkout has no
// specified failure case in the source docs — a plain try/catch-shaped
// mutate() + toast covers the mock service's one real failure mode
// (artwork not found).
export function CheckoutConfirmStep({
  artwork,
  address,
  onBack,
  onOrderPlaced,
  placedOrder,
}: CheckoutConfirmStepProps) {
  const createOrderMutation = useCreateOrderMutation();
  const [payOpen, setPayOpen] = useState(false);

  const total =
    artwork.customerPrice +
    Math.round(artwork.customerPrice * CHECKOUT_GST_RATE * 100) / 100 +
    CHECKOUT_DELIVERY_CHARGE;

  // Payment first, order second: an order only exists once the gateway has
  // returned a reference, so there is never a paid-but-orderless state or an
  // order with no payment against it.
  function handlePaid(payment: NonNullable<Order["payment"]>) {
    createOrderMutation.mutate(
      { artworkId: artwork.id, addressId: address.id, payment },
      {
        onSuccess: (order) => {
          onOrderPlaced(order);
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Could not place order",
          );
        },
      },
    );
  }

  if (placedOrder) {
    const paidTotal =
      placedOrder.amount + placedOrder.gstAmount + placedOrder.deliveryCharge;
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
          <CheckCircle2
            className="size-7 text-gold-bright"
            strokeWidth={1.75}
          />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Order placed
          </h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            &ldquo;{artwork.title}&rdquo; is on its way to {address.city}.
            We&rsquo;ll keep you updated as it moves through packing and
            dispatch.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Total paid{" "}
          <span className="font-medium text-foreground">
            {formatINR(paidTotal)}
          </span>
        </p>
        {placedOrder.payment && (
          <p className="font-mono text-xs text-muted-foreground">
            {placedOrder.payment.paymentId}
            {placedOrder.payment.simulated ? " · simulated payment" : ""}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Button
            nativeButton={false}
            render={<Link href={`/account/orders/${placedOrder.id}`} />}
          >
            View order
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/marketplace" />}
          >
            Continue browsing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Ready to place your order
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You&rsquo;re buying &ldquo;{artwork.title}&rdquo;, delivered to{" "}
          {address.line1}, {address.city}. Paying opens a stand-in for the
          Razorpay checkout — no money moves until live keys are connected.
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-5">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={createOrderMutation.isPending}
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          Back
        </Button>
        <Button
          onClick={() => setPayOpen(true)}
          disabled={createOrderMutation.isPending}
        >
          {createOrderMutation.isPending && (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          )}
          {createOrderMutation.isPending
            ? "Placing order…"
            : `Pay ${formatINR(total)}`}
        </Button>
      </div>

      <RazorpaySimulation
        open={payOpen}
        onOpenChange={setPayOpen}
        amount={total}
        artworkTitle={artwork.title}
        onPaid={handlePaid}
      />
    </div>
  );
}
