"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSubmitTicketMutation } from "@/hooks/useSupport";

/**
 * A customer-side "Request a refund" affordance on the order page.
 *
 * Under the hood this creates a support ticket with pre-filled context (order
 * id, artwork, amount) so GalleryZone's support inbox already knows what
 * the request is about — the customer just explains WHY. We route through
 * tickets rather than a dedicated refund entity so refund judgement stays
 * with a human until policy is written down, and so cancelled-order
 * refunds (which the gateway already triggers automatically) don't collide
 * with a parallel ledger of "requested" refunds.
 */
export function RequestRefundDialog({
  orderId,
  artworkTitle,
  totalLabel,
  disabled = false,
}: {
  orderId: string;
  artworkTitle: string;
  /** Rendered as-is in the ticket body, e.g. "₹1,23,456". */
  totalLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const submit = useSubmitTicketMutation();

  function handleSubmit() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    const subject = `Refund request — Order ${orderId.slice(-8)}`;
    const message = [
      `Order: ${orderId}`,
      `Artwork: ${artworkTitle}`,
      `Total paid: ${totalLabel}`,
      "",
      "Reason:",
      trimmed,
    ].join("\n");
    submit.mutate(
      { subject, message },
      {
        onSuccess: () => {
          setOpen(false);
          setReason("");
        },
      },
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Request a refund
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request a refund</DialogTitle>
          <DialogDescription>
            Tell support what&rsquo;s wrong with this order. They&rsquo;ll
            reply by email, usually within a working day.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="refund-reason">Reason</Label>
          <Textarea
            id="refund-reason"
            rows={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What's wrong? The more detail the better."
            maxLength={2000}
            disabled={submit.isPending}
          />
          <p className="text-xs text-muted-foreground">
            We&rsquo;ll include the order id, the artwork, and the amount in
            your request so you don&rsquo;t have to.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submit.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submit.isPending || reason.trim().length < 5}
          >
            {submit.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Sending…
              </>
            ) : (
              "Send request"
            )}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
