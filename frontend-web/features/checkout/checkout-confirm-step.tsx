"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { useCreateOrderMutation } from "@/hooks/useOrders";
import { PaymentDismissedError } from "@/lib/razorpay-checkout";
import { useCheckoutQuote } from "@/hooks/useCheckoutQuote";
import { PayeeDetails } from "@/components/shared/payee-details";
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

// Step 3 of checkout: one action. The service creates the order, opens
// the Razorpay checkout and confirms the payment with the API; closing
// the payment window leaves the order pending and the buyer here.
export function CheckoutConfirmStep({
  artwork,
  address,
  onBack,
  onOrderPlaced,
  placedOrder,
}: CheckoutConfirmStepProps) {
  const createOrderMutation = useCreateOrderMutation();

  const { data: quote } = useCheckoutQuote(artwork.id);
  const total = quote?.total ?? 0;

  function handlePay() {
    createOrderMutation.mutate(
      { artworkId: artwork.id, addressId: address.id },
      {
        onSuccess: (order) => {
          onOrderPlaced(order);
        },
        onError: (error) => {
          if (error instanceof PaymentDismissedError) {
            toast.info("Payment cancelled — nothing was charged.");
            return;
          }
          toast.error(
            error instanceof Error ? error.message : "Could not place order",
          );
        },
      },
    );
  }

  if (placedOrder) {
    // gstAmount is the tax already inside `amount`, never an addition to it.
    const paidTotal = placedOrder.amount + placedOrder.deliveryCharge;
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
          {address.line1}, {address.city}. Paying opens the secure Razorpay
          checkout — UPI, cards and net banking.
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
          onClick={handlePay}
          disabled={createOrderMutation.isPending || !quote}
        >
          {createOrderMutation.isPending && (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          )}
          {createOrderMutation.isPending
            ? "Waiting for payment…"
            : quote
              ? `Pay ${formatINR(total)}`
              : "Working out your total…"}
        </Button>
      </div>

      {/* Payment always reaches GalleryZone, including when the buyer is
          standing in a partner gallery — the aggregator collects on our behalf
          and never for themselves. */}
      <PayeeDetails
        amount={total}
        note={`GZ ${artwork.title.slice(0, 24)}`}
      />

    </div>
  );
}
