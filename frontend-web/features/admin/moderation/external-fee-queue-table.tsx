"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ReceiptText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import { RejectReasonDialog } from "@/features/admin/reject-reason-dialog";
import {
  useAdminExternalSaleFees,
  useDecideExternalSaleFeeMutation,
} from "@/hooks/useAdminModeration";
import { formatINR } from "@/lib/utils";
import {
  PENALTY_STATUS_LABEL,
  penaltyStatus,
  type ExternalSalePenalty,
  type PenaltyStatus,
} from "@/types/artwork";

// Where the 1% off-platform sale fee is actually decided. Nothing is charged
// until a row here is approved — selling elsewhere is not automatically bad
// faith, and the artist should not be billed by a rule nobody looked at.

const WAIVE_PRESETS = [
  "Piece was promised to a gallery before it was listed here",
  "Sale fell through and the listing was withdrawn in good faith",
  "First off-platform sale for this artist",
  "Fee waived as a goodwill gesture",
];

const STATUSES: PenaltyStatus[] = ["pending_review", "approved", "waived"];

export function ExternalFeeQueueTable() {
  const { data: fees, isPending } = useAdminExternalSaleFees();
  const decide = useDecideExternalSaleFeeMutation();
  const [waiving, setWaiving] = useState<ExternalSalePenalty | null>(null);

  const rows = fees ?? [];

  function approve(row: ExternalSalePenalty) {
    decide.mutate(
      { id: row.id, approve: true },
      {
        onSuccess: () =>
          toast.success(
            `${formatINR(row.amount)} will be charged on the artist's next listing.`,
          ),
      },
    );
  }

  function waive(note: string) {
    if (!waiving) return;
    decide.mutate(
      { id: waiving.id, approve: false, note },
      {
        onSuccess: () => {
          toast.info(`Fee waived for "${waiving.artworkTitle}".`);
          setWaiving(null);
        },
      },
    );
  }

  const columns: AdminDataTableColumn<ExternalSalePenalty>[] = [
    {
      key: "artwork",
      header: "Artwork",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.artworkTitle}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.artworkId}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.artworkTitle,
    },
    {
      key: "amount",
      header: "Fee",
      render: (row) => (
        <span className="font-mono text-sm tabular-nums text-foreground">
          {formatINR(row.amount)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => -row.amount,
    },
    {
      key: "raised",
      header: "Raised",
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
      sortValue: (row) => row.createdAt,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {PENALTY_STATUS_LABEL[penaltyStatus(row)]}
          {row.settledAt ? " · collected" : ""}
          {row.decisionNote ? ` · ${row.decisionNote}` : ""}
        </span>
      ),
      sortable: true,
      sortValue: (row) => penaltyStatus(row),
    },
    {
      key: "actions",
      header: "",
      render: (row) =>
        penaltyStatus(row) === "pending_review" ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={decide.isPending}
              onClick={() => approve(row)}
            >
              <Check className="size-3.5" />
              Charge
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={decide.isPending}
              onClick={() => setWaiving(row)}
            >
              <X className="size-3.5" />
              Waive
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <AdminDataTable
        rows={rows}
        columns={columns}
        isLoading={isPending}
        getRowKey={(row) => row.id}
        searchPlaceholder="Search fees"
        searchValue={(row) => `${row.artworkTitle} ${row.artworkId}`}
        filters={[
          {
            key: "status",
            label: "Status",
            options: STATUSES.map((s) => ({
              value: s,
              label: PENALTY_STATUS_LABEL[s],
            })),
            matches: (row, value) => penaltyStatus(row) === value,
          },
        ]}
        emptyTitle="No off-platform sale fees"
        emptyDescription="Nothing has been marked sold on another platform."
        emptyIcon={ReceiptText}
      />

      <RejectReasonDialog
        open={Boolean(waiving)}
        onOpenChange={(open) => !open && setWaiving(null)}
        title={`Waive the fee on "${waiving?.artworkTitle ?? ""}"`}
        description="The artist sees this reason on their next listing. Nothing is charged."
        presets={WAIVE_PRESETS}
        label="Reason for waiving"
        confirmLabel="Waive fee"
        isPending={decide.isPending}
        onSubmit={waive}
      />
    </>
  );
}
