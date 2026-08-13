"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EyeOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminStatusBadge } from "@/features/admin/admin-status-badge";
import { ConfirmActionDialog } from "@/features/admin/confirm-action-dialog";
import { useDelistArtworkMutation } from "@/hooks/useAdminCatalog";
import { useAdminAuditStore } from "@/store/useAdminAuditStore";
import { ADMIN } from "@/features/admin/admin-data";
import { formatINR } from "@/lib/utils";
import type { Artwork, ArtworkStatus } from "@/types/artwork";

const STATUS_LABEL: Record<ArtworkStatus, string> = {
  draft: "Draft saved",
  pending_approval: "Submitted for review",
  marketplace: "Published to marketplace",
  reserved: "Reserved by aggregator",
  preparing_dispatch: "Preparing dispatch",
  in_transit: "In transit",
  with_aggregator: "With aggregator",
  sold: "Sold",
  settlement_complete: "Settlement complete",
  delivered: "Delivered",
  completed: "Completed",
  returned: "Returned",
};

export function ArtworkAdminDetail({ artwork }: { artwork: Artwork }) {
  const queryClient = useQueryClient();
  const appendAudit = useAdminAuditStore((s) => s.append);
  const delistMutation = useDelistArtworkMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isLive = artwork.status === "marketplace";
  const sortedImages = [...artwork.images].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const history = [...artwork.statusHistory].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
  );

  async function handleDelist() {
    try {
      await delistMutation.mutateAsync(artwork.id);
      queryClient.setQueryData<Artwork[]>(["admin-artworks"], (prev) =>
        (prev ?? []).map((a) =>
          a.id === artwork.id ? { ...a, status: "returned" } : a,
        ),
      );
      appendAudit({
        adminName: ADMIN.name,
        action: "artwork.delisted",
        entityType: "artwork",
        entityId: artwork.id,
        entityLabel: artwork.title,
      });
      setConfirmOpen(false);
      toast.success("Artwork delisted", {
        description: `“${artwork.title}” is no longer visible on the marketplace.`,
      });
    } catch {
      toast.error("Could not delist artwork. Try again.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="relative aspect-[4/3] w-full bg-muted">
            {sortedImages[0] ? (
              <Image
                src={sortedImages[0].url}
                alt={sortedImages[0].altText}
                fill
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-contain"
              />
            ) : null}
          </div>
        </div>

        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-foreground">
              Status history
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Append-only. Every transition this work has been through.
            </p>
          </div>
          <ol className="px-5 py-4">
            {history.map((event, index) => {
              const isLast = index === history.length - 1;
              return (
                <li
                  key={`${event.status}-${event.changedAt}`}
                  className="relative flex gap-4 pb-5 last:pb-0"
                >
                  {!isLast ? (
                    <span
                      aria-hidden
                      className="absolute top-3 left-[5px] h-full w-px bg-border"
                    />
                  ) : null}
                  <span
                    aria-hidden
                    className={`relative mt-1.5 size-2.5 shrink-0 rounded-full ${
                      isLast ? "bg-gold-bright" : "bg-border"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {STATUS_LABEL[event.status]}
                    </p>
                    <time
                      dateTime={event.changedAt}
                      className="text-xs text-muted-foreground"
                    >
                      {new Date(event.changedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold text-foreground">
                {artwork.title}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {artwork.artistName}
              </p>
            </div>
            <AdminStatusBadge status={artwork.status} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
            <Detail
              label="Category"
              value={artwork.category}
              className="capitalize"
            />
            <Detail label="Medium" value={artwork.medium} />
            <Detail
              label="Dimensions"
              value={artwork.dimensions ?? "Not set"}
            />
            <Detail
              label="Year"
              value={artwork.yearCreated?.toString() ?? "Not set"}
            />
            <Detail
              label="Customer price"
              value={formatINR(artwork.customerPrice)}
            />
            <Detail label="Insured" value={artwork.insured ? "Yes" : "No"} />
          </dl>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-base font-semibold text-foreground">
            Identity & provenance
          </h2>
          <dl className="mt-3 space-y-3">
            <Detail
              label="COA certificate"
              value={artwork.coaCertificateNumber}
              mono
            />
            <Detail
              label="COA issued"
              value={new Date(artwork.coaIssueDate).toLocaleDateString(
                "en-IN",
                {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                },
              )}
            />
          </dl>
          <Link
            href={`/verify/${artwork.id}`}
            target="_blank"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-gold-bright transition-colors hover:text-gold"
          >
            View public passport
            <ExternalLink className="size-3.5" />
          </Link>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-base font-semibold text-foreground">
            Admin actions
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {isLive
              ? "Delisting pulls this work from the marketplace immediately."
              : "This work is not currently live on the marketplace."}
          </p>
          <Button
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            disabled={!isLive || delistMutation.isPending}
            className="mt-3 w-full"
          >
            <EyeOff className="size-4" />
            Delist from marketplace
          </Button>
        </section>
      </div>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delist “${artwork.title}”?`}
        description="It disappears from the marketplace straight away. The artist keeps the work and can resubmit it."
        confirmLabel="Delist"
        destructive
        isPending={delistMutation.isPending}
        onConfirm={handleDelist}
      />
    </div>
  );
}

function Detail({
  label,
  value,
  className,
  mono = false,
}: {
  label: string;
  value: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`truncate text-sm text-foreground ${mono ? "font-mono tabular-nums" : ""} ${className ?? ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
