"use client";

import { useState } from "react";
import { Copy, Check, QrCode, Landmark } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import { PAYEE, PAYEE_UPI_ID, upiIntentFor } from "@/lib/payee";

// Where the money goes, shown wherever someone has to actually send it: the
// checkout page, and the aggregator's screen when a buyer is standing in front
// of them. One component, because an account number typed twice is an account
// number that will eventually differ.
//
// No QR is drawn until there is a live UPI ID. A code that scans to a
// non-existent VPA is worse than no code — someone would try to pay it.
export function PayeeDetails({
  amount,
  note,
  className,
}: {
  amount: number;
  /** Shows in the payer's app so the transfer can be matched to an order. */
  note: string;
  className?: string;
}) {
  const upiIntent = upiIntentFor(amount, note);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-background">
          <Landmark className="size-4 text-gold-bright" strokeWidth={1.75} />
        </span>
        <div>
          <h3 className="font-display text-base font-semibold text-foreground">
            Pay GalleryZone directly
          </h3>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            Transfer {formatINR(amount)} to the account below. Payment always
            goes to GalleryZone, including when you are buying at a partner
            gallery.
          </p>
        </div>
      </div>

      <dl className="flex flex-col gap-2 rounded-md border border-border bg-background p-3.5 text-sm">
        <CopyRow label="Account name" value={PAYEE.accountName} />
        <CopyRow label="Account number" value={PAYEE.accountNumber} mono />
        <CopyRow label="IFSC" value={PAYEE.ifsc} mono />
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Bank</dt>
          <dd className="text-right text-foreground">
            {PAYEE.bankName}, {PAYEE.branch}
          </dd>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-2">
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="truncate text-right font-mono text-xs text-foreground">
            {note}
          </dd>
        </div>
      </dl>

      <div className="flex items-center gap-3 rounded-md border border-dashed border-border p-3.5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-background">
          <QrCode
            className="size-6 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {PAYEE_UPI_ID ? "Scan to pay by UPI" : "UPI QR"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {upiIntent
              ? "Scan with any UPI app to pay the exact amount."
              : "Appears here once the live UPI ID is connected. Until then, use the account details above."}
          </p>
        </div>
      </div>
    </div>
  );
}

function CopyRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure origin, or the user said no). The value is
      // on screen either way, so there is nothing to recover from.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            "truncate text-right text-foreground",
            mono && "font-mono",
          )}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <Check className="size-3.5 text-gold-bright" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </dd>
    </div>
  );
}
