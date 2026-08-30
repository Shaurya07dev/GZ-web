"use client";

import Image from "next/image";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/shared/price-tag";
import { useReleaseHoldingMutation } from "@/hooks/useAggregatorCollection";
import { formatINR } from "@/lib/utils";
import type { AggregatorHolding } from "@/types/aggregator";
import type { ArtworkSummary } from "@/types/artwork";

interface ReturnHoldingDialogProps {
  holding: (AggregatorHolding & { artwork: ArtworkSummary }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Replaces a plain window.confirm() — same two numbers it used to state in a
// browser alert (advance refunded, delivery forfeited), now laid out the way
// every other money-moving action in this portal is (RecordSaleDialog,
// ReserveArtworkPage): a real dialog with the figures broken out, not a
// sentence to parse. Shared by CollectionTable and HoldingDetail — the second
// call site is what earned this its own file instead of living inline.
export function ReturnHoldingDialog({
  holding,
  open,
  onOpenChange,
}: ReturnHoldingDialogProps) {
  const releaseMutation = useReleaseHoldingMutation();

  if (!holding) return null;

  const deliveryLost = holding.deliveryDeposit ?? 0;

  function handleConfirm() {
    if (!holding) return;
    releaseMutation.mutate(holding.id, {
      onSuccess: ({ refunded, deliveryLost }) => {
        toast.success("Returned to GalleryZone", {
          description:
            `${formatINR(refunded)} advance released.` +
            (deliveryLost > 0
              ? ` ${formatINR(deliveryLost)} delivery was charged.`
              : ""),
        });
        onOpenChange(false);
      },
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!releaseMutation.isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Return this piece to GalleryZone</DialogTitle>
          <DialogDescription>
            It stops showing in your inventory and becomes reservable by
            another aggregator, at next month&rsquo;s price.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
            <Image
              src={holding.artwork.thumbnailUrl}
              alt={holding.artwork.title}
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {holding.artwork.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {holding.artwork.artistName}
            </p>
          </div>
          <PriceTag amount={holding.displayPrice} className="text-sm" />
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border px-3.5 py-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                Advance ({holding.advancePercent}%)
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Released back to your wallet
              </p>
            </div>
            <span className="font-mono tabular-nums text-foreground">
              {formatINR(holding.advanceAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <div>
              <p className="font-medium text-foreground">Delivery deposit</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {deliveryLost > 0
                  ? "Only refunded on a sale — forfeited on an unsold return"
                  : "Nothing was held for delivery"}
              </p>
            </div>
            <span
              className={`font-mono tabular-nums ${deliveryLost > 0 ? "text-destructive" : "text-foreground"}`}
            >
              {deliveryLost > 0 ? "−" : ""}
              {formatINR(deliveryLost)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={releaseMutation.isPending}
          >
            Keep it
          </Button>
          <Button
            variant={deliveryLost > 0 ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={releaseMutation.isPending}
          >
            <Undo2 className="size-3.5" strokeWidth={2} />
            {releaseMutation.isPending ? "Returning…" : "Return to GalleryZone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
