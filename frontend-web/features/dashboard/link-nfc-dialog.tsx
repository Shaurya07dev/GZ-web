"use client";

import { useState } from "react";
import { Copy, Loader2, Nfc, Radio, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLinkNfcTagMutation } from "@/hooks/useLinkNfcTag";
import { verifyUrlFor } from "@/lib/verify-url";

interface LinkNfcDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworkId: string;
  artworkTitle: string;
}

type DialogStep = "idle" | "scanning" | "success";

export function LinkNfcDialog({
  open,
  onOpenChange,
  artworkId,
  artworkTitle,
}: LinkNfcDialogProps) {
  const [step, setStep] = useState<DialogStep>("idle");
  const verifyUrl = verifyUrlFor(artworkId);
  const { mutateAsync } = useLinkNfcTagMutation();

  function handleCopyUrl() {
    void navigator.clipboard.writeText(verifyUrl).then(() => {
      toast.success("URL copied to clipboard");
    });
  }

  async function handleSimulate() {
    setStep("scanning");
    // Simulate the ~800 ms physical tap + write delay
    await new Promise((r) => setTimeout(r, 900));
    try {
      await mutateAsync({ artworkId });
      setStep("success");
      toast.success(`NFC Tag successfully linked to "${artworkTitle}"`, {
        description: "The tag is ready to be attached to the physical artwork.",
        duration: 5000,
      });
    } catch (err) {
      setStep("idle");
      toast.error("Tag write failed", {
        description:
          err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) setStep("idle");
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Nfc className="size-4 text-gold-bright" strokeWidth={1.75} />
            Link NFC Tag
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 pb-2">
          {/* Artwork context */}
          <p className="text-sm text-muted-foreground">
            Linking a physical NFC chip to{" "}
            <span className="font-medium text-foreground">
              &ldquo;{artworkTitle}&rdquo;
            </span>
          </p>

          {step === "success" ? (
            <SuccessPanel />
          ) : (
            <>
              {/* Instructions */}
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3.5">
                <p className="text-xs font-medium text-foreground">
                  How to program the tag
                </p>
                <ol className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground list-decimal list-inside">
                  <li>Hold a blank NTAG 424 DNA chip near the back of your phone.</li>
                  <li>The URL below will be written as its NDEF record.</li>
                  <li>Once written the chip is locked — it cannot be re-programmed.</li>
                </ol>
              </div>

              {/* URL preview */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  NFC URL (NDEF payload)
                </p>
                <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5">
                  <span className="flex-1 truncate font-mono text-[11px] text-gold-bright">
                    {verifyUrl}
                  </span>
                  <button
                    type="button"
                    id="nfc-dialog-copy-url"
                    onClick={handleCopyUrl}
                    aria-label="Copy verification URL"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Pulse ring during scanning */}
              {step === "scanning" && <ScanningIndicator />}

              {/* CTA */}
              <button
                id="nfc-dialog-simulate-btn"
                type="button"
                disabled={step === "scanning"}
                onClick={() => void handleSimulate()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gold/50 bg-gold/10 px-4 py-2.5 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/20 disabled:pointer-events-none disabled:opacity-50"
              >
                {step === "scanning" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Scanning & writing…
                  </>
                ) : (
                  <>
                    <Radio className="size-4" />
                    Simulate NFC tap
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-muted-foreground">
                &ldquo;Simulate&rdquo; writes a generated tag ID without
                physical hardware — for dev/QA only.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScanningIndicator() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="relative flex size-16 items-center justify-center">
        {/* Outer ring 1 */}
        <span
          className="absolute inset-0 rounded-full border border-gold/30 animate-ping"
          style={{ animationDuration: "1.4s" }}
        />
        {/* Outer ring 2 */}
        <span
          className="absolute inset-2 rounded-full border border-gold/40 animate-ping"
          style={{ animationDuration: "1.4s", animationDelay: "0.2s" }}
        />
        {/* Core icon */}
        <Nfc className="relative z-10 size-6 text-gold-bright" strokeWidth={1.5} />
      </div>
      <p className="text-xs text-muted-foreground">
        Hold tag near device…
      </p>
    </div>
  );
}

function SuccessPanel() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-6 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15">
        <ShieldCheck className="size-6 text-emerald-400" strokeWidth={1.75} />
      </span>
      <p className="font-display text-base font-semibold text-foreground">
        Tag linked successfully
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        The chip is now paired to this artwork. Attach it behind the artist&apos;s
        signature on the canvas, then photograph the placement for the record.
      </p>
      <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-medium text-gold-bright">
        <Sparkles className="size-3" />
        NTAG 424 DNA ready
      </span>
    </div>
  );
}
