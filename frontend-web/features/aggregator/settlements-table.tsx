"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Landmark } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import {
  AdminStatusBadge,
  adminStatusLabel,
} from "@/features/admin/admin-status-badge";
import {
  useAggregatorSettlements,
  useProcessSettlementMutation,
} from "@/hooks/useAggregatorSettlements";
import { formatINR } from "@/lib/utils";
import type { Settlement, SettlementStatus } from "@/types/admin";

const STATUSES: SettlementStatus[] = ["pending", "processed", "failed"];

// This is the one settlements table in the app where aggregatorCommission
// is the real, non-zero figure that matters — the artist's own equivalent
// shows artistAmount as the primary number with aggregatorCommission at 0.
export function SettlementsTable() {
  const { data: settlements, isPending } = useAggregatorSettlements();
  const [active, setActive] = useState<Settlement | null>(null);
  const processMutation = useProcessSettlementMutation();

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
            Sale {row.orderId}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.artworkTitle,
    },
    {
      key: "commission",
      header: "Commission",
      render: (row) => (
        <span className="text-sm font-medium tabular-nums text-gold-bright">
          {formatINR(row.aggregatorCommission)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.aggregatorCommission,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <AdminStatusBadge status={row.status} size="sm" />,
      sortable: true,
      sortValue: (row) => row.status,
    },
    {
      key: "created",
      header: "Created",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
      sortable: true,
      sortValue: (row) => -new Date(row.createdAt).getTime(),
    },
    {
      key: "action",
      header: "",
      render: (row) =>
        row.status === "pending" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={processMutation.isPending}
            onClick={() =>
              processMutation.mutate(row.orderId, {
                onSuccess: () => toast.success("Settlement processed"),
                onError: (error) => toast.error(error.message),
              })
            }
          >
            Simulate settlement
          </Button>
        ) : null,
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
        emptyDescription="A commission breakdown appears here once a piece sells."
        emptyIcon={Landmark}
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
  return (
    <Dialog
      open={Boolean(settlement)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-md">
        {settlement && (
          <>
            <DialogHeader>
              <DialogTitle>{settlement.artworkTitle}</DialogTitle>
            </DialogHeader>

            <div className="flex items-center justify-between gap-3 border-y border-border py-3">
              <span className="text-sm text-muted-foreground">Status</span>
              <AdminStatusBadge status={settlement.status} size="sm" />
            </div>

            <dl className="space-y-2.5">
              <div className="flex items-baseline justify-between">
                <dt className="text-sm text-muted-foreground">
                  Your commission
                </dt>
                <dd className="font-display text-lg font-semibold tabular-nums text-gold-bright">
                  {formatINR(settlement.aggregatorCommission)}
                </dd>
              </div>
            </dl>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Sale</dt>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
