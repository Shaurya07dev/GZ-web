"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, Smartphone, CreditCard, Landmark } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn, formatINR } from "@/lib/utils";
import type { Order } from "@/types/order";

// A stand-in for the Razorpay checkout, deliberately marked as a simulation.
// No keys, no network call, no money — it collects a method, waits, and
// returns a payment reference shaped like Razorpay's own (`pay_...`).
//
// Swapping in the real gateway means replacing runSimulatedPayment() with the
// Razorpay SDK handler and verifying the signature server-side. Everything
// downstream — the order carrying `payment`, the receipt showing the id —
// stays as it is.

const METHODS = [
  { value: "upi", label: "UPI", hint: "Google Pay, PhonePe, Paytm", icon: Smartphone },
  { value: "card", label: "Card", hint: "Credit or debit", icon: CreditCard },
  { value: "netbanking", label: "Net banking", hint: "All major banks", icon: Landmark },
];

function simulatedPaymentId(): string {
  return `pay_${Math.random().toString(36).slice(2, 16).toUpperCase()}`;
}

export function RazorpaySimulation({
  open,
  onOpenChange,
  amount,
  artworkTitle,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  artworkTitle: string;
  onPaid: (payment: NonNullable<Order["payment"]>) => void;
}) {
  const [method, setMethod] = useState("upi");
  const [status, setStatus] = useState<"idle" | "processing">("idle");

  function pay() {
    setStatus("processing");
    // Deliberate delay: a payment that returns instantly trains everyone
    // reviewing the demo to expect something the real gateway won't do.
    window.setTimeout(() => {
      setStatus("idle");
      onPaid({
        provider: "razorpay",
        paymentId: simulatedPaymentId(),
        method,
        simulated: true,
      });
      onOpenChange(false);
    }, 1400);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => status === "idle" && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Pay with Razorpay
            <span className="rounded border border-gold/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-gold-bright">
              SIMULATION
            </span>
          </DialogTitle>
          <DialogDescription>
            No money moves. This stands in for the Razorpay checkout until live
            keys are connected.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-baseline justify-between rounded-md border border-gold/30 bg-gold/5 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Paying for</p>
            <p className="truncate text-sm font-medium text-foreground">
              {artworkTitle}
            </p>
          </div>
          <p className="font-mono text-lg font-semibold tabular-nums text-gold-bright">
            {formatINR(amount)}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Payment method
          </p>
          {METHODS.map((option) => {
            const active = method === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={status === "processing"}
                onClick={() => setMethod(option.value)}
                className={cn(
                  "flex items-center gap-3 rounded-md border p-3 text-left transition-colors disabled:opacity-60",
                  active
                    ? "border-gold/50 bg-gold/10"
                    : "border-border hover:border-gold/30",
                )}
              >
                <option.icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-gold-bright" : "text-muted-foreground",
                  )}
                  strokeWidth={1.75}
                />
                <span className="flex-1">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      active ? "text-gold-bright" : "text-foreground",
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {option.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <Button onClick={pay} disabled={status === "processing"}>
          {status === "processing" && (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          )}
          {status === "processing" ? "Processing…" : `Pay ${formatINR(amount)}`}
        </Button>

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3 shrink-0" strokeWidth={1.75} />
          With the live gateway, GalleryZone never sees your card or UPI
          details — Razorpay collects them and returns only a payment
          reference.
        </p>
      </DialogContent>
    </Dialog>
  );
}
