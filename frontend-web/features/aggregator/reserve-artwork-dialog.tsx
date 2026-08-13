"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceTag } from "@/components/shared/price-tag";
import { formatINR } from "@/lib/utils";
import {
  advancePercentFor,
  advanceAmountFor,
} from "@/services/aggregatorService";
import { useReserveArtworkMutation } from "@/hooks/useAggregatorInventory";
import type { ArtworkSummary } from "@/types/artwork";

interface ReserveArtworkDialogProps {
  artwork: ArtworkSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Confirmation dialog for the reserve flow (Task 23). The advance preview
// below is computed with the exact same exported helpers
// aggregatorService.reserve() itself uses (see services/aggregatorService.ts)
// rather than a duplicated threshold, so what the aggregator sees here can
// never drift out of sync with what actually gets recorded on confirm.
export function ReserveArtworkDialog({
  artwork,
  open,
  onOpenChange,
}: ReserveArtworkDialogProps) {
  const [simulateConflict, setSimulateConflict] = useState(false);
  const reserveMutation = useReserveArtworkMutation();

  if (!artwork) return null;

  const advancePercent = advancePercentFor(artwork.customerPrice);
  const advanceAmount = advanceAmountFor(artwork.customerPrice, advancePercent);

  function handleConfirm() {
    if (!artwork) return;
    reserveMutation.mutate(
      { artworkId: artwork.id, simulateConflict },
      {
        onSuccess: () => {
          toast.success("Artwork reserved", {
            description: `"${artwork.title}" is now in your Collection.`,
          });
          onOpenChange(false);
          setSimulateConflict(false);
        },
        onError: (error) => {
          // Mirrors the real 409 race-condition UX (SAD §3.5): the dialog
          // closes and the card is deliberately left in the grid (query
          // isn't invalidated on error), same as if another aggregator had
          // genuinely reserved it first.
          toast.error(error.message);
          onOpenChange(false);
          setSimulateConflict(false);
        },
      },
    );
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
            Confirming pays the advance and moves this artwork into your
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
          <PriceTag amount={artwork.customerPrice} className="text-sm" />
        </div>

        <div className="flex items-center justify-between rounded-md border border-gold/25 bg-gold/5 px-3.5 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Advance due today
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {advancePercent}% of {formatINR(artwork.customerPrice)}
            </p>
          </div>
          <span className="font-display text-lg font-semibold tabular-nums text-gold-bright">
            {formatINR(advanceAmount)}
          </span>
        </div>

        <label className="flex items-start gap-2.5 rounded-md border border-dashed border-border px-3 py-2.5">
          <Checkbox
            checked={simulateConflict}
            onCheckedChange={(checked) => setSimulateConflict(checked)}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <AlertTriangle
                className="size-3 text-muted-foreground"
                strokeWidth={2}
              />
              Simulate reservation conflict
              <span className="rounded-sm border border-border px-1 py-px text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
                Dev
              </span>
            </span>
            <span className="text-[11px] leading-snug text-muted-foreground">
              Demos the 409 &ldquo;lost the race&rdquo; error another aggregator
              can trigger.
            </span>
          </span>
        </label>

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
