"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RejectReasonDialog } from "@/features/admin/reject-reason-dialog";
import {
  useAdminAdvanceOrderStatusMutation,
  useAdminRefundOrderMutation,
} from "@/hooks/useAdminCommerce";
import type { OrderStatus } from "@/types/order";

// What the admin can do on this order right now, derived from its current
// status. Mirrors backend `orderStateMachine` in packages/domain: only the
// transitions on that graph are offered, so the UI can never queue a call
// the backend is going to reject. (See packages/domain/src/state-machine.ts.)
//
// Refund is offered on paid/confirmed/packed — delivered can't be refunded
// here because the piece has physically shipped; pending has never been
// paid; cancelled was already closed out.
function nextStatus(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case "paid":
      return "confirmed";
    case "confirmed":
      return "packed";
    case "packed":
      return "transit";
    case "transit":
      return "delivered";
    default:
      return null;
  }
}

function advanceLabel(next: OrderStatus): string {
  switch (next) {
    case "confirmed":
      return "Mark as confirmed";
    case "packed":
      return "Mark as packed";
    case "transit":
      return "Mark as shipped";
    case "delivered":
      return "Mark as delivered";
    default:
      return "Advance status";
  }
}

const canRefund = (s: OrderStatus) =>
  s === "paid" || s === "confirmed" || s === "packed";

/**
 * The "what admin can do about this order" strip, dropped into the admin
 * order detail page. One block per available action. Shows nothing when
 * the order is in a terminal state (delivered/cancelled/pending).
 *
 * 9 Nov 2026 — added after the full-flow audit found that (a) refund was
 * being done by hand in the Razorpay dashboard with no record on the
 * order, and (b) advance-status endpoint had no caller so dispatch was
 * invisible to buyers.
 */
export function AdminOrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [refundOpen, setRefundOpen] = useState(false);
  const refund = useAdminRefundOrderMutation(orderId);
  const advance = useAdminAdvanceOrderStatusMutation(orderId);
  const next = nextStatus(status);

  if (!next && !canRefund(status)) return null;

  return (
    <>
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-base font-semibold text-foreground">
          Actions
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {next && (
            <Button
              onClick={() =>
                advance.mutate(next, {
                  onSuccess: () => toast.success(`Order ${advanceLabel(next).toLowerCase()}`),
                  onError: (error) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Could not advance status",
                    ),
                })
              }
              disabled={advance.isPending}
            >
              {advance.isPending && <Loader2 className="size-4 animate-spin" />}
              {advanceLabel(next)}
            </Button>
          )}
          {canRefund(status) && (
            <Button
              variant="destructive"
              onClick={() => setRefundOpen(true)}
              disabled={refund.isPending}
            >
              {refund.isPending && <Loader2 className="size-4 animate-spin" />}
              Refund order
            </Button>
          )}
        </div>
      </section>

      <RejectReasonDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        title="Refund this order"
        description={
          <>
            This reverses the Razorpay charge on the captured payment and marks
            the order cancelled. The reason is written to the audit log and
            shown to the buyer in their account history.
          </>
        }
        label="Reason for refund"
        placeholder="Why is this order being refunded?"
        confirmLabel="Issue refund"
        helpText="Recorded on the audit log. Refund is processed by Razorpay immediately."
        isPending={refund.isPending}
        onSubmit={(reason) =>
          refund.mutate(reason, {
            onSuccess: () => {
              toast.success("Refund issued");
              setRefundOpen(false);
            },
            onError: (error) =>
              toast.error(
                error instanceof Error ? error.message : "Refund failed",
              ),
          })
        }
      />
    </>
  );
}
