"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { downloadCoaPdf, type CoaPdfInput } from "./coa-pdf";

// One button, used wherever a certificate is shown (artist board preview,
// public passport, buyer's collection). Disabled until a number exists —
// numbers are issued when the artwork is approved for listing.
export function DownloadCoaButton({
  certificate,
  className,
}: {
  certificate: CoaPdfInput;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const ready = Boolean(certificate.coaCertificateNumber);

  async function handleClick() {
    setBusy(true);
    try {
      await downloadCoaPdf(certificate);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't build the certificate PDF.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!ready || busy}
      title={ready ? undefined : "Issued when the artwork is approved for listing"}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border border-gold/60 px-4 py-2.5 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      Download certificate (PDF)
    </button>
  );
}
