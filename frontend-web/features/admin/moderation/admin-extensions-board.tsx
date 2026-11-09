"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { RejectReasonDialog } from "@/features/admin/reject-reason-dialog";
import {
  useAdminPendingExtensions,
  useDecideExtensionMutation,
} from "@/hooks/useAdminCatalog";
import { formatINR } from "@/lib/utils";
import type { AggregatorHolding } from "@/types/aggregator";
import type { ArtworkSummary } from "@/types/artwork";

type Row = AggregatorHolding & { artwork: ArtworkSummary };

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Admin moderation queue for aggregator "keep the piece past its window"
 * requests. Each card shows the aggregator's assurance alongside the
 * holding's current window so the admin has what they need to decide
 * without a second lookup.
 *
 * Approve is one-click; Decline opens a dialog for a required note that
 * the aggregator sees in their email. 9 Nov 2026.
 */
export function AdminExtensionsBoard() {
  const { data: rows, isPending } = useAdminPendingExtensions();
  const decide = useDecideExtensionMutation();
  const [decliningId, setDecliningId] = useState<string | null>(null);

  function approve(row: Row) {
    decide.mutate(
      { holdingId: row.id, decision: "approve" },
      {
        onSuccess: () => toast.success("Extension approved"),
        onError: (error) =>
          toast.error(
            error instanceof Error ? error.message : "Could not approve",
          ),
      },
    );
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No pending extension requests"
        description="When an aggregator asks to keep a piece past its window, their request lands here with the assurance they gave."
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const request = row.extensionRequest;
          return (
            <section
              key={row.id}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-semibold text-foreground">
                      {row.artwork.title}
                    </h3>
                    <Link
                      href={`/admin/artworks/${row.artwork.id}`}
                      className="inline-flex items-center gap-1 text-xs text-gold-bright hover:text-gold"
                    >
                      Artwork
                      <ExternalLink className="size-3" />
                    </Link>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {row.artwork.artistName}
                  </p>
                </div>
                <dl className="flex gap-6 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Window ends</dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {formatDateTime(row.expiresAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Display price</dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {formatINR(row.displayPrice)}
                    </dd>
                  </div>
                </dl>
              </div>

              {request?.assurance && (
                <blockquote className="mt-4 rounded-md border border-border bg-background/50 p-3 text-sm text-foreground">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Aggregator&apos;s assurance
                  </p>
                  <p className="mt-1">{request.assurance}</p>
                </blockquote>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => approve(row)}
                  disabled={decide.isPending}
                >
                  Approve — move window on 30 days
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDecliningId(row.id)}
                  disabled={decide.isPending}
                >
                  Decline
                </Button>
              </div>
            </section>
          );
        })}
      </div>

      <RejectReasonDialog
        open={decliningId !== null}
        onOpenChange={(open) => !open && setDecliningId(null)}
        title="Decline extension"
        description={
          <>
            The window will end on schedule and the piece will go back on the
            marketplace. The aggregator sees your note by email.
          </>
        }
        label="Reason for decline"
        placeholder="Why can&apos;t this extension be granted?"
        confirmLabel="Decline extension"
        helpText="Recorded on the audit log and emailed to the aggregator."
        isPending={decide.isPending}
        onSubmit={(note) => {
          if (!decliningId) return;
          decide.mutate(
            { holdingId: decliningId, decision: "decline", note },
            {
              onSuccess: () => {
                toast.success("Extension declined");
                setDecliningId(null);
              },
              onError: (error) =>
                toast.error(
                  error instanceof Error ? error.message : "Could not decline",
                ),
            },
          );
        }}
      />
    </>
  );
}
