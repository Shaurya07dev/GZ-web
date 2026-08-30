"use client";

import { useState, type FormEvent } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatINR } from "@/lib/utils";
import { usePullBackHoldingMutation } from "@/hooks/useAdminCatalog";
import type { AggregatorHolding } from "@/types/aggregator";

interface PullBackHoldingDialogProps {
  holding: AggregatorHolding | null;
  artworkTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// GalleryZone reclaiming a piece mid-placement, distinct from the aggregator
// returning it themselves — same end state for the artwork, different question
// about whose fault the placement not finishing was. The advance is always
// released; the delivery leg is the admin's call per case, the same way an
// off-platform sale fee is decided rather than ruled in advance (see
// approve/rejectPenalty in adminService.ts).
export function PullBackHoldingDialog({
  holding,
  artworkTitle,
  open,
  onOpenChange,
}: PullBackHoldingDialogProps) {
  const [reason, setReason] = useState("");
  const [refundDelivery, setRefundDelivery] = useState(false);
  const pullBackMutation = usePullBackHoldingMutation();

  if (!holding) return null;

  const delivery = holding.deliveryDeposit ?? 0;

  function handleClose(next: boolean) {
    if (pullBackMutation.isPending) return;
    onOpenChange(next);
    if (!next) {
      setReason("");
      setRefundDelivery(false);
      pullBackMutation.reset();
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!holding || !reason.trim()) return;
    pullBackMutation.mutate(
      { holdingId: holding.id, reason: reason.trim(), refundDelivery },
      { onSuccess: () => handleClose(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pull back &ldquo;{artworkTitle}&rdquo;</DialogTitle>
          <DialogDescription>
            Ends the placement immediately. The piece leaves the aggregator&rsquo;s
            display and becomes reservable again.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Advance released</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatINR(holding.advanceAmount)}
              </span>
            </div>
            {delivery > 0 && (
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-muted-foreground">Delivery deposit</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatINR(delivery)}
                </span>
              </div>
            )}
          </div>

          {delivery > 0 && (
            <label className="flex items-start gap-2.5 rounded-md border border-border px-3 py-2.5">
              <Checkbox
                checked={refundDelivery}
                onCheckedChange={(checked) => setRefundDelivery(checked === true)}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  Also refund the delivery deposit
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  Off by default: an unsold return normally costs the
                  aggregator this leg. Turn it on when the placement not
                  finishing isn&rsquo;t on them.
                </span>
              </span>
            </label>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pullBackReason">Reason</Label>
            <Textarea
              id="pullBackReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this piece is being pulled back"
              rows={3}
              required
            />
            <p className="text-xs text-muted-foreground">
              Shown to the aggregator alongside the wallet entry.
            </p>
          </div>

          {pullBackMutation.isError && (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              {pullBackMutation.error.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={pullBackMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!reason.trim() || pullBackMutation.isPending}
            >
              {pullBackMutation.isPending ? "Pulling back…" : "Pull back"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
