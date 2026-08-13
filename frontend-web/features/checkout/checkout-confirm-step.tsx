"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { useCreateOrderMutation } from "@/hooks/useOrders";
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

  function handlePlaceOrder() {
    createOrderMutation.mutate(
      { artworkId: artwork.id, addressId: address.id },
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
    const total =
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
            {formatINR(total)}
          </span>
        </p>
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
          {address.line1}, {address.city}. There&rsquo;s no payment form in this
          preview build; confirming places the order at the price shown in
          review.
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
          onClick={handlePlaceOrder}
          disabled={createOrderMutation.isPending}
        >
          {createOrderMutation.isPending && (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          )}
          {createOrderMutation.isPending ? "Placing order…" : "Place Order"}
        </Button>
      </div>
    </div>
  );
}
