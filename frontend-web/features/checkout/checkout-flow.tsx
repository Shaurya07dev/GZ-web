"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CheckoutAddressStep } from "./checkout-address-step";
import { CheckoutReviewStep } from "./checkout-review-step";
import { CheckoutConfirmStep } from "./checkout-confirm-step";
import type { Artwork } from "@/types/artwork";
import type { Address } from "@/types/customer";
import type { Order } from "@/types/order";

type CheckoutStep = "address" | "review" | "confirm";

const STEPS: { key: CheckoutStep; label: string }[] = [
  { key: "address", label: "Address" },
  { key: "review", label: "Review" },
  { key: "confirm", label: "Confirm" },
];

interface CheckoutFlowProps {
  artwork: Artwork;
}

// Client-side orchestrator for the three checkout steps — one page, no
// separate routes per step, same "internal step transition" shape as the
// Register page's role-picker-then-form flow. Holds the selected Address
// object (not just an id) so Review/Confirm never need to re-derive it from
// a query cache that (per the mock-service pattern) won't reflect a
// same-session newly-added address after refetch.
export function CheckoutFlow({ artwork }: CheckoutFlowProps) {
  const [step, setStep] = useState<CheckoutStep>("address");
  const [address, setAddress] = useState<Address | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  function goToStep(index: number) {
    // Only allow jumping backward, and never once the order is placed.
    if (placedOrder) return;
    if (index < 0 || index > stepIndex) return;
    setStep(STEPS[index].key);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <ol className="flex items-center gap-2" aria-label="Checkout progress">
        {STEPS.map((s, index) => {
          const isComplete =
            index < stepIndex || Boolean(placedOrder && index <= stepIndex);
          const isCurrent = index === stepIndex;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => goToStep(index)}
                disabled={index > stepIndex || Boolean(placedOrder)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-medium transition-colors disabled:cursor-default",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    isComplete
                      ? "border-gold bg-gold-bright text-background"
                      : isCurrent
                        ? "border-gold-bright text-gold-bright"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {isComplete ? (
                    <Check className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <span
                  className={cn(
                    "h-px flex-1",
                    index < stepIndex ? "bg-gold/50" : "bg-border",
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl border border-border bg-background/60 p-5 sm:p-7">
        {step === "address" && (
          <CheckoutAddressStep
            selectedAddressId={address?.id ?? null}
            onSelect={setAddress}
            onContinue={() => setStep("review")}
          />
        )}

        {step === "review" && address && (
          <CheckoutReviewStep
            artwork={artwork}
            address={address}
            onBack={() => setStep("address")}
            onContinue={() => setStep("confirm")}
          />
        )}

        {step === "confirm" && address && (
          <CheckoutConfirmStep
            artwork={artwork}
            address={address}
            onBack={() => setStep("review")}
            onOrderPlaced={setPlacedOrder}
            placedOrder={placedOrder}
          />
        )}
      </div>
    </div>
  );
}
