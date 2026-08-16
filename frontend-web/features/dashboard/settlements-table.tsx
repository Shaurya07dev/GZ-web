"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
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
import { useArtistSettlements } from "@/hooks/useArtistSettlements";
import { formatINR } from "@/lib/utils";
import type { Settlement, SettlementStatus } from "@/types/admin";

const STATUSES: SettlementStatus[] = ["pending", "processed", "failed"];

function settlementTotal(row: Settlement): number {
  return row.artistAmount + row.aggregatorCommission + row.platformRevenue;
}

export function SettlementsTable() {
  const { data: settlements, isPending } = useArtistSettlements();
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
            Order {row.orderId}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.artworkTitle,
    },
    {
      key: "payout",
      header: "Your payout",
      render: (row) => (
        <span className="text-sm font-medium tabular-nums text-foreground">
          {formatINR(row.artistAmount)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.artistAmount,
    },
    {
      key: "platform",
      header: "Platform fee",
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
        searchPlaceholder="Search by artwork"
        searchValue={(row) => `${row.artworkTitle} ${row.orderId}`}
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
        emptyTitle="No settlements yet"
        emptyDescription="A payout breakdown appears here once a piece sells."
        emptyIcon={Receipt}
      />

      <SettlementDetailDialog
        settlement={active}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function SettlementDetailDialog({
  settlement,
  onClose,
}: {
  settlement: Settlement | null;
  onClose: () => void;
}) {
  const total = settlement ? settlementTotal(settlement) : 0;

  return (
    <Dialog
      open={Boolean(settlement)}
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
                label="Your payout"
                value={settlement.artistAmount}
                total={total}
              />
              <Split
                label="Aggregator commission"
                value={settlement.aggregatorCommission}
                total={total}
              />
              <Split
                label="Platform fee"
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

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Order</dt>
                <dd className="truncate text-sm text-foreground">
                  {settlement.orderId}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Processed</dt>
                <dd className="truncate text-sm text-foreground">
                  {settlement.processedAt
                    ? new Date(settlement.processedAt).toLocaleDateString(
                        "en-IN",
                        { day: "numeric", month: "short", year: "numeric" },
                      )
                    : "Not yet"}
                </dd>
              </div>
            </dl>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
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
