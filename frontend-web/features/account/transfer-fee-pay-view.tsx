"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, CircleAlert } from "lucide-react";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import {
  useStartTransferFeeSession,
  useTransfer,
  useVerifyTransferFeePayment,
} from "@/hooks/useOwnershipTransfers";

function inr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

/**
 * The sender's "pay the 5% fee" screen. Loads the transfer, shows the
 * split (2% artist royalty, 3% GalleryZone, 18% GST on the fee), opens
 * Razorpay Checkout.js and verifies through the API when the modal
 * closes. The webhook is still the source of truth — this view polls
 * the transfer's status so a webhook win is reflected without a reload.
 */
export function TransferFeePayView({ transferId }: { transferId: string }) {
  const { data: transfer, isLoading, refetch } = useTransfer(transferId);
  const startSession = useStartTransferFeeSession();
  const verifyPayment = useVerifyTransferFeePayment();
  const [error, setError] = useState<string | null>(null);

  // Lightweight poll while awaiting_payment, so a webhook that beats
  // verify flips the view automatically.
  useEffect(() => {
    if (transfer?.status !== "awaiting_payment") return;
    const id = setInterval(() => refetch(), 4000);
    return () => clearInterval(id);
  }, [transfer?.status, refetch]);

  if (isLoading) {
    return (
      <Panel
        tone="ok"
        title="Loading transfer…"
        body="Reading the transfer details."
      />
    );
  }

  if (!transfer) {
    return (
      <Panel
        tone="warn"
        title="This transfer isn't available"
        body="It may have been cancelled, or the link is wrong."
      />
    );
  }

  if (transfer.status === "cancelled") {
    return (
      <Panel
        tone="warn"
        title="The transfer was cancelled"
        body={`Nothing is owed. ${transfer.toName} will not receive “${transfer.artworkTitle}”.`}
      />
    );
  }

  if (transfer.status === "accepted") {
    return (
      <Panel
        tone="ok"
        title="Transfer complete"
        body={`“${transfer.artworkTitle}” is now recorded to ${transfer.toName}. The artwork's passport shows the full chain.`}
        action={
          <Link
            href={`/verify/${transfer.artworkId}`}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-5 py-2.5 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02]"
          >
            View the passport
            <ArrowRight className="size-3.5" />
          </Link>
        }
      />
    );
  }

  // transfer.status is "pending" (recipient hasn't confirmed) or
  // "awaiting_payment" (they have — now owe the fee).
  const confirmed = transfer.status === "awaiting_payment";
  const total = transfer.feeTotalPaise ?? 0;
  const royalty = transfer.royaltyPaise ?? 0;
  const platform = transfer.platformFeeNetPaise ?? 0;
  const gst = transfer.feeGstPaise ?? 0;
  const giving = transfer.givingPricePaise ?? 0;

  async function pay() {
    setError(null);
    try {
      const session = await startSession.mutateAsync(transfer!.id);
      if (session.mode === "simulated") {
        // No gateway configured — verify will still mark the transfer
        // paid once the admin or a test flow posts it through.
        await verifyPayment.mutateAsync(transfer!.id);
        return;
      }
      if (!session.keyId || !session.razorpayOrderId) {
        setError("Payments are not fully configured yet. Please try again shortly.");
        return;
      }
      const outcome = await openRazorpayCheckout({
        mode: "razorpay",
        keyId: session.keyId,
        razorpayOrderId: session.razorpayOrderId,
        amountPaise: session.amountPaise,
        currency: session.currency ?? "INR",
        name: session.name ?? "GalleryZone",
        description: session.description ?? "Resale transfer fee",
        prefill: session.prefill ?? { name: "", email: "", contact: "" },
      });
      if (outcome.failureMessage) setError(outcome.failureMessage);
      // Whatever Checkout.js said — success, dismiss, failure — ask our
      // API. Only the server's re-read decides whether money moved.
      await verifyPayment.mutateAsync(transfer!.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the payment page");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-16 lg:py-24">
      <div className="flex flex-col gap-2 text-center">
        <p className="font-mono text-xs tracking-[0.16em] text-gold-bright uppercase">
          GalleryZone transfer
        </p>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {confirmed
            ? `${transfer.toName} confirmed — pay to finalise`
            : `Waiting on ${transfer.toName}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {confirmed
            ? `The 5% platform fee on ${inr(giving)} is now due. Pay it to pass ownership to ${transfer.toName}.`
            : `The invite was sent. We'll email you the moment ${transfer.toName} confirms, so you can pay the transfer fee.`}
        </p>
      </div>

      <div className="rounded-lg border border-gold/30 bg-card p-5 text-sm">
        <Row label="Artwork" value={transfer.artworkTitle} />
        <Row label="To" value={`${transfer.toName} · ${transfer.toEmail}`} />
        <Row label="Giving price" value={inr(giving)} />
        <div className="my-3 border-t border-border/60" />
        <Row label="Artist royalty (2%)" value={inr(royalty)} muted />
        <Row label="GalleryZone (3%)" value={inr(platform)} muted />
        <Row label="GST on the fee (18%)" value={inr(gst)} muted />
        <div className="my-3 border-t border-border/60" />
        <Row label="Transfer fee" value={inr(total)} bold />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <button
        type="button"
        onClick={pay}
        disabled={!confirmed || startSession.isPending || verifyPayment.isPending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-6 py-3 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
      >
        {startSession.isPending || verifyPayment.isPending
          ? "Opening the payment page…"
          : confirmed
            ? `Pay ${inr(total)}`
            : `Waiting for ${transfer.toName} to confirm`}
      </button>

      <p className="text-xs text-muted-foreground">
        The money for the piece itself is settled between you and{" "}
        {transfer.toName} off-platform. GalleryZone only charges this fee,
        and the 2% is paid out to the original artist after.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className={`text-xs ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {label}
      </dt>
      <dd
        className={`text-right ${bold ? "text-base font-semibold text-foreground" : "font-medium text-foreground"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Panel({
  tone,
  title,
  body,
  action,
}: {
  tone: "ok" | "warn";
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  const Icon = tone === "ok" ? ShieldCheck : CircleAlert;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
      <span
        className={`flex size-11 items-center justify-center rounded-full border ${
          tone === "ok"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
            : "border-border bg-secondary text-muted-foreground"
        }`}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <h1 className="font-display text-xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}
