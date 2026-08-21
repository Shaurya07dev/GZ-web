"use client";

import Link from "next/link";
import { ShieldCheck, CircleAlert, ArrowRight } from "lucide-react";
import { useTransfer, useAcceptTransferMutation } from "@/hooks/useOwnershipTransfers";

// What the incoming owner sees when they open the transfer link. Deliberately
// public: the person accepting may not have a GalleryZone account yet, and the
// page shows nothing confidential — a title, who is handing it over, and the
// button that moves the record.
export function TransferAcceptView({ transferId }: { transferId: string }) {
  const { data: transfer, isLoading } = useTransfer(transferId);
  const acceptMutation = useAcceptTransferMutation();

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-20 text-center text-sm text-muted-foreground">
        Checking this transfer…
      </div>
    );
  }

  if (!transfer) {
    return (
      <Panel
        tone="warn"
        title="This transfer link isn’t valid"
        body="It may have been mistyped, or the transfer was removed. Ask the sender for a new link."
      />
    );
  }

  if (transfer.status === "cancelled") {
    return (
      <Panel
        tone="warn"
        title="This transfer was cancelled"
        body={`${transfer.fromName} cancelled the hand-over of “${transfer.artworkTitle}”. Nothing has changed on the ownership record.`}
      />
    );
  }

  if (transfer.status === "accepted" || acceptMutation.isSuccess) {
    return (
      <Panel
        tone="ok"
        title="Ownership transferred"
        body={`“${transfer.artworkTitle}” is now recorded to ${transfer.toName}. The artwork’s passport shows the full chain of ownership.`}
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

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-16 lg:py-24">
      <div className="flex flex-col gap-2 text-center">
        <p className="font-mono text-xs tracking-[0.16em] text-gold-bright uppercase">
          GalleryZone passport
        </p>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {transfer.fromName} is transferring ownership to you
        </h1>
      </div>

      <div className="rounded-lg border border-gold/30 bg-card p-5">
        <dl className="flex flex-col gap-3 text-sm">
          <Row label="Artwork" value={transfer.artworkTitle} />
          <Row label="From" value={transfer.fromName} />
          <Row label="To" value={`${transfer.toName} · ${transfer.toEmail}`} />
        </dl>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        Accepting records you as the artwork&rsquo;s owner on its digital
        passport. The previous owners stay in its history — provenance is added
        to, never rewritten.
      </p>

      {acceptMutation.isError && (
        <p className="text-sm text-destructive">
          {acceptMutation.error instanceof Error
            ? acceptMutation.error.message
            : "Something went wrong."}
        </p>
      )}

      <button
        type="button"
        onClick={() => acceptMutation.mutate(transfer.id)}
        disabled={acceptMutation.isPending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-6 py-3 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
      >
        Accept ownership
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
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
      <h1 className="font-display text-xl font-semibold text-foreground">
        {title}
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}
