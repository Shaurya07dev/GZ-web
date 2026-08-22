"use client";

import Image from "next/image";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import {
  CHECKOUT_GST_RATE,
  CHECKOUT_DELIVERY_CHARGE,
  CHECKOUT_PLATFORM_FEE,
  CHECKOUT_CONVENIENCE_FEE,
} from "@/services/orderService";
import type { Artwork } from "@/types/artwork";
import type { Address } from "@/types/customer";

interface CheckoutReviewStepProps {
  artwork: Artwork;
  address: Address;
  onBack: () => void;
  onContinue: () => void;
}

// Step 2 of checkout: a read-only summary before the customer commits.
// The GST/delivery math here is pinned to orderService's own exported
// constants (CHECKOUT_GST_RATE, CHECKOUT_DELIVERY_CHARGE) rather than a
// second hardcoded copy, so this preview can never silently drift from
// what orderService.create actually charges when "Place Order" is pressed.
export function CheckoutReviewStep({
  artwork,
  address,
  onBack,
  onContinue,
}: CheckoutReviewStepProps) {
  const gstAmount =
    Math.round(artwork.customerPrice * CHECKOUT_GST_RATE * 100) / 100;
  const total = artwork.customerPrice + gstAmount + CHECKOUT_DELIVERY_CHARGE;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Review your order
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm the artwork, delivery address, and total before placing your
          order.
        </p>
      </div>

      <div className="flex gap-4 rounded-lg border border-border bg-card p-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
          <Image
            src={artwork.thumbnailUrl}
            alt={artwork.title}
            fill
            sizes="80px"
            className="object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-0.5">
          <p className="text-xs text-gold-bright">{artwork.category}</p>
          <p className="truncate font-display text-base font-semibold text-foreground">
            {artwork.title}
          </p>
          <p className="text-sm text-muted-foreground">{artwork.artistName}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <MapPin className="size-3.5 text-gold-bright" strokeWidth={1.75} />
          Delivering to
        </p>
        <p className="mt-2 text-sm text-foreground">
          {address.line1}
          {address.line2 ? `, ${address.line2}` : ""}
          <br />
          {address.city}, {address.state} {address.pincode}
        </p>
      </div>

      <dl className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Artwork price</dt>
          <dd className="tabular-nums text-foreground">
            {formatINR(artwork.customerPrice)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">GST (5%)</dt>
          <dd className="tabular-nums text-foreground">
            {formatINR(gstAmount)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Platform fee</dt>
          <dd className="tabular-nums text-emerald-500 font-medium">
            {CHECKOUT_PLATFORM_FEE === 0 ? "Free" : formatINR(CHECKOUT_PLATFORM_FEE)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Convenience fee</dt>
          <dd className="tabular-nums text-emerald-500 font-medium">
            {CHECKOUT_CONVENIENCE_FEE === 0 ? "Free" : formatINR(CHECKOUT_CONVENIENCE_FEE)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Delivery</dt>
          <dd className="tabular-nums text-foreground">
            {formatINR(CHECKOUT_DELIVERY_CHARGE)}
          </dd>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-border pt-2.5">
          <dt className="font-medium text-foreground">Total</dt>
          <dd className="font-display text-lg font-semibold tabular-nums text-gold-bright">
            {formatINR(total)}
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-between border-t border-border pt-5">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          Back
        </Button>
        <Button onClick={onContinue}>Continue to confirm</Button>
      </div>
    </div>
  );
}
