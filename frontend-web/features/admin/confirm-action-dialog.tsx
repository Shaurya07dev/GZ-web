"use client";

import { useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** ReactNode, not string: callers routinely need a bolded name or an amount. */
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions (delist, delete, suspend) get the red confirm button. */
  destructive?: boolean;
  /**
   * Optional controlled pending state. Pass a mutation's `isPending` when the
   * caller owns the async work; omit it and this dialog tracks the promise
   * returned by onConfirm itself.
   */
  isPending?: boolean;
  onConfirm: () => void | Promise<void>;
}

// The shared "are you sure" for every non-reason-requiring admin action:
// approve artwork, approve KYC, approve withdrawal, retry settlement, delist,
// delete category, suspend/activate user. Actions that need a *reason* use
// RejectReasonDialog instead.
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  isPending,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [internalPending, setInternalPending] = useState(false);
  const pending = isPending ?? internalPending;

  async function handleConfirm() {
    if (pending) return;
    try {
      setInternalPending(true);
      await onConfirm();
    } finally {
      // Always clears, including when onConfirm rejects -- a dialog stuck on
      // "Working..." after a failed mutation is worse than the error itself.
      // The caller surfaces the failure (toast/inline) and decides whether to
      // close; this component only owns its own button state.
      setInternalPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {destructive && (
              <TriangleAlert
                className="size-4 shrink-0 text-destructive"
                strokeWidth={2}
                aria-hidden
              />
            )}
            {title}
          </DialogTitle>
          <DialogDescription render={<div />}>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
