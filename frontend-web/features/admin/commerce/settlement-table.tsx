"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import {
  AdminStatusBadge,
  adminStatusLabel,
} from "@/features/admin/admin-status-badge";
import { ConfirmActionDialog } from "@/features/admin/confirm-action-dialog";
import {
  useAdminSettlements,
  useRetrySettlementMutation,
} from "@/hooks/useAdminCommerce";
import { useAdminAuditStore } from "@/store/useAdminAuditStore";
import { formatINR } from "@/lib/utils";
import type { Settlement, SettlementStatus } from "@/types/admin";

const STATUSES: SettlementStatus[] = ["pending", "processed", "failed"];

function settlementTotal(row: Settlement): number {
  return row.artistAmount + row.aggregatorCommission + row.platformRevenue;
}

export function SettlementTable() {
  const { data: settlements, isPending } = useAdminSettlements();
  const [active, setActive] = useState<Settlement | null>(null);

  const columns: AdminDataTableColumn<Settlement>[] = [
    {
      key: "artwork",
      header: "Artwork",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.artworkTitle}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.artistName}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.artworkTitle,
    },
    {
      key: "artist",
      header: "Artist",
      render: (row) => (
        <span className="text-sm tabular-nums text-foreground">
          {formatINR(row.artistAmount)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.artistAmount,
    },
    {
      key: "aggregator",
      header: "Aggregator",
      render: (row) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.aggregatorCommission > 0
            ? formatINR(row.aggregatorCommission)
            : "N/A"}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.aggregatorCommission,
    },
    {
      key: "platform",
      header: "Platform",
      render: (row) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatINR(row.platformRevenue)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.platformRevenue,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <AdminStatusBadge status={row.status} size="sm" />,
      sortable: true,
      sortValue: (row) => row.status,
    },
  ];

  return (
    <>
      <AdminDataTable
        rows={settlements ?? []}
        columns={columns}
        isLoading={isPending}
        getRowKey={(row) => row.id}
        onRowClick={(row) => setActive(row)}
        getRowLabel={(row) => `Open settlement for ${row.artworkTitle}`}
        searchPlaceholder="Search by artwork or artist"
        searchValue={(row) =>
          `${row.artworkTitle} ${row.artistName} ${row.orderId}`
        }
        filters={[
          {
            key: "status",
            label: "Status",
            options: STATUSES.map((s) => ({
              value: s,
              label: adminStatusLabel(s),
            })),
            matches: (row, value) => row.status === value,
          },
        ]}
        emptyTitle="No settlements"
        emptyDescription="Nothing matches the current filters."
        emptyIcon={Receipt}
      />

      <SettlementDetailDrawer
        settlement={active}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function SettlementDetailDrawer({
  settlement,
  onClose,
}: {
  settlement: Settlement | null;
  onClose: () => void;
}) {
  const adminName = useCurrentUser().data?.name ?? "Admin";
  const queryClient = useQueryClient();
  const appendAudit = useAdminAuditStore((s) => s.append);
  const retryMutation = useRetrySettlementMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleRetry() {
    if (!settlement) return;
    try {
      await retryMutation.mutateAsync(settlement.id);
      queryClient.setQueryData<Settlement[]>(["admin-settlements"], (prev) =>
        (prev ?? []).map((s) =>
          s.id === settlement.id
            ? {
                ...s,
                status: "processed",
                processedAt: new Date().toISOString(),
              }
            : s,
        ),
      );
      appendAudit({
        adminName: adminName,
        action: "settlement.retried",
        entityType: "settlement",
        entityId: settlement.id,
        entityLabel: settlement.artworkTitle,
      });
      setConfirmOpen(false);
      onClose();
      toast.success("Settlement reprocessed", {
        description: `${settlement.artworkTitle} has been settled.`,
      });
    } catch {
      toast.error("Could not reprocess settlement. Try again.");
    }
  }

  const total = settlement ? settlementTotal(settlement) : 0;

  return (
    <>
      <Dialog
        open={Boolean(settlement) && !confirmOpen}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent className="max-w-lg">
          {settlement ? (
            <>
              <DialogHeader>
                <DialogTitle>{settlement.artworkTitle}</DialogTitle>
              </DialogHeader>

              <div className="flex items-center justify-between gap-3 border-y border-border py-3">
                <span className="text-sm text-muted-foreground">Status</span>
                <AdminStatusBadge status={settlement.status} size="sm" />
              </div>

              <dl className="space-y-2.5">
                <Split
                  label="Artist payout"
                  value={settlement.artistAmount}
                  total={total}
                />
                <Split
                  label="Aggregator commission"
                  value={settlement.aggregatorCommission}
                  total={total}
                />
                <Split
                  label="Platform revenue"
                  value={settlement.platformRevenue}
                  total={total}
                />
                <div className="flex items-baseline justify-between border-t border-border pt-2.5">
                  <dt className="text-sm font-medium text-foreground">
                    Order total
                  </dt>
                  <dd className="font-display text-lg font-semibold tabular-nums text-foreground">
                    {formatINR(total)}
                  </dd>
                </div>
              </dl>

              {settlement.payoutMethod ? (
                <section className="mt-4 rounded-md border border-gold/40 bg-gold/5 p-3.5">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-gold-bright">
                    Payout destination
                  </h3>
                  <dl className="mt-2 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-xs text-muted-foreground">
                        Recipient
                      </dt>
                      <dd className="truncate text-sm text-foreground">
                        {settlement.payoutMethod.recipientName}
                      </dd>
                    </div>
                    {settlement.payoutMethod.bankAccountMasked ? (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">
                          Account
                        </dt>
                        <dd className="truncate font-mono text-sm tabular-nums text-foreground">
                          {settlement.payoutMethod.bankAccountMasked}
                        </dd>
                      </div>
                    ) : null}
                    {settlement.payoutMethod.ifsc ? (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">IFSC</dt>
                        <dd className="truncate font-mono text-sm tabular-nums text-foreground">
                          {settlement.payoutMethod.ifsc}
                        </dd>
                      </div>
                    ) : null}
                    {settlement.payoutMethod.upiHandle ? (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">UPI</dt>
                        <dd className="truncate font-mono text-sm tabular-nums text-foreground">
                          {settlement.payoutMethod.upiHandle}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {!settlement.payoutMethod.bankAccountMasked &&
                  !settlement.payoutMethod.upiHandle ? (
                    <p className="mt-2 text-xs text-destructive">
                      No payout method on file — ask the recipient to update
                      their profile before you transfer.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Transfer {formatINR(settlement.artistAmount)} via your
                      banking app, then mark this settlement processed.
                    </p>
                  )}
                </section>
              ) : null}

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Order</dt>
                  <dd className="truncate text-sm">
                    <Link
                      href={`/admin/orders/${settlement.orderId}`}
                      className="text-gold-bright transition-colors hover:text-gold"
                    >
                      {settlement.orderId}
                    </Link>
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Processed</dt>
                  <dd className="truncate text-sm text-foreground">
                    {settlement.processedAt
                      ? new Date(settlement.processedAt).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        )
                      : "Not yet"}
                  </dd>
                </div>
              </dl>

              {settlement.status === "failed" ? (
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={retryMutation.isPending}
                  className="mt-4 w-full"
                >
                  <RotateCw className="size-4" />
                  Retry settlement
                </Button>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Retry this settlement?"
        description="Reprocessing is safe to repeat. The platform guards against double-crediting a wallet."
        confirmLabel="Retry"
        isPending={retryMutation.isPending}
        onConfirm={handleRetry}
      />
    </>
  );
}

function Split({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const share = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted-foreground">
        {label}
        <span className="ml-1.5 text-xs text-muted-foreground/70">
          {share}%
        </span>
      </dt>
      <dd className="text-sm tabular-nums text-foreground">
        {formatINR(value)}
      </dd>
    </div>
  );
}
