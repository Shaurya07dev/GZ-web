"use client";

import Image from "next/image";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceBreakdown } from "@/components/shared/price-breakdown";
import { checkoutTotal } from "@/lib/pricing";
import type { Artwork } from "@/types/artwork";
import type { Address } from "@/types/customer";

interface CheckoutReviewStepProps {
  artwork: Artwork;
  address: Address;
  onBack: () => void;
  onContinue: () => void;
}

// Step 2 of checkout: a read-only summary before the customer commits.
// The totals come from checkoutTotal() in lib/pricing.ts — the same function
// orderService.create() uses to build the order — so this preview cannot drift
// from what "Place Order" actually charges.
export function CheckoutReviewStep({
  artwork,
  address,
  onBack,
  onContinue,
}: CheckoutReviewStepProps) {
  const totals = checkoutTotal(artwork.customerPrice);

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

      <PriceBreakdown
        displayPrice={totals.displayPrice}
        gstIncluded={totals.gstIncluded}
        deliveryCharge={totals.deliveryCharge}
        convenienceFee={totals.convenienceFee}
      />

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
