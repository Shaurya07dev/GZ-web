"use client";

import Image from "next/image";
import { toast } from "sonner";
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
import { formatINR } from "@/lib/utils";
import type { ReservableArtwork } from "@/services/aggregatorService";
import { AGGREGATOR_CYCLE_MONTHS } from "@/lib/pricing";
import { useReserveArtworkMutation } from "@/hooks/useAggregatorInventory";
import { useAggregatorWallet } from "@/hooks/useAggregatorWallet";

interface ReserveArtworkDialogProps {
  artwork: ReservableArtwork | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Confirmation dialog for the reserve flow. Every figure shown comes from the
// `offer` the service already attached to this artwork — the same object
// reserve() acts on — so the preview cannot drift from what is recorded on
// confirm. The advance is HELD from the wallet, not charged, which is why the
// free balance is shown next to it.
export function ReserveArtworkDialog({
  artwork,
  open,
  onOpenChange,
}: ReserveArtworkDialogProps) {
  const reserveMutation = useReserveArtworkMutation();
  const { data: wallet } = useAggregatorWallet();

  if (!artwork) return null;

  const { offer } = artwork;
  const free = wallet ? wallet.balance - wallet.lockedBalance : 0;
  const shortfall = Math.max(0, offer.payable - free);

  function handleConfirm() {
    if (!artwork) return;
    reserveMutation.mutate(artwork.id, {
      onSuccess: () => {
        toast.success("Artwork reserved", {
          description: `"${artwork.title}" is now in your Collection.`,
        });
        onOpenChange(false);
      },
      onError: (error) => {
        // The grid is refetched rather than left as it was: a reserve that
        // fails is usually the grid disagreeing with the store, and leaving
        // the card sitting there means the next click fails the same way and
        // the one after that.
        toast.error(error.message);
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!reserveMutation.isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reserve this artwork</DialogTitle>
          <DialogDescription>
            Month {offer.month} of {AGGREGATOR_CYCLE_MONTHS}. Confirming holds
            the advance from your wallet and moves this artwork into your
            Collection for a 30-day display window.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
            <Image
              src={artwork.thumbnailUrl}
              alt={artwork.title}
              fill
              sizes="56px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {artwork.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {artwork.artistName}
            </p>
          </div>
          <PriceTag amount={offer.offerPrice} className="text-sm" />
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-gold/25 bg-gold/5 px-3.5 py-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                Advance ({Math.round(offer.advanceRate * 100)}%)
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                of the{" "}
                {offer.advanceBasis === "display_price"
                  ? "display price"
                  : "artist price"}
                , {formatINR(offer.advanceBase)}
              </p>
            </div>
            <span className="font-mono tabular-nums text-foreground">
              {formatINR(offer.advance)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Delivery</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Returned when the piece sells, not if it comes back
              </p>
            </div>
            <span className="font-mono tabular-nums text-foreground">
              {formatINR(offer.deliveryCharge)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between border-t border-gold/20 pt-2">
            <div>
              <p className="font-medium text-foreground">Held from your wallet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatINR(Math.max(0, free))} free right now
              </p>
            </div>
            <span className="font-display text-lg font-semibold tabular-nums text-gold-bright">
              {formatINR(offer.payable)}
            </span>
          </div>
        </div>

        {shortfall > 0 && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            Add {formatINR(shortfall)} to your wallet before reserving this
            piece. Money is held, not spent — it comes back when the piece sells.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={reserveMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={reserveMutation.isPending}>
            {reserveMutation.isPending ? "Reserving…" : "Confirm reservation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
