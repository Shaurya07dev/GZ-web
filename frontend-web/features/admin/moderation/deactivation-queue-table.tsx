"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import { RejectReasonDialog } from "@/features/admin/reject-reason-dialog";
import {
  useAdminDeactivationRequests,
  useDecideDeactivationMutation,
} from "@/hooks/useAdminModeration";

import type { DeactivationRequest, DeactivationStatus } from "@/types/admin";

// The deciding end of an artist's account closure. Approving suspends the
// account, which is the state the Artists table already renders — this queue
// does not invent a second notion of "closed".

const REJECT_PRESETS = [
  "Settlement still outstanding on this account",
  "Artwork still held by an aggregator",
  "An ownership transfer is waiting to be accepted",
  "Could not verify the request with the account holder",
];

const STATUSES: DeactivationStatus[] = ["pending", "approved", "rejected"];

const STATUS_LABEL: Record<DeactivationStatus, string> = {
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Refused",
};

function waitingDays(row: DeactivationRequest): number {
  return Math.max(
    0,
    Math.round(
      (Date.now() - new Date(row.requestedAt).getTime()) /
        86_400_000,
    ),
  );
}

export function DeactivationQueueTable() {
  const { data: requests, isPending } = useAdminDeactivationRequests();
  const decide = useDecideDeactivationMutation();
  const [rejecting, setRejecting] = useState<DeactivationRequest | null>(null);

  const rows = requests ?? [];

  function approve(row: DeactivationRequest) {
    decide.mutate(
      { id: row.id, approve: true },
      {
        onSuccess: () =>
          toast.success(`${row.userName}'s account has been deactivated.`),
      },
    );
  }

  function reject(note: string) {
    if (!rejecting) return;
    decide.mutate(
      { id: rejecting.id, approve: false, note },
      {
        onSuccess: () => {
          toast.info(`Closure refused for ${rejecting.userName}.`);
          setRejecting(null);
        },
      },
    );
  }

  const columns: AdminDataTableColumn<DeactivationRequest>[] = [
    {
      key: "user",
      header: "Artist",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.userName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.userId}</p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.userName,
    },
    {
      key: "reason",
      header: "Reason",
      render: (row) => (
        <p className="max-w-xs text-sm text-muted-foreground">{row.reason}</p>
      ),
    },
    {
      key: "waiting",
      header: "Waiting",
      render: (row) =>
        row.status === "pending" ? (
          <span className="text-sm text-muted-foreground">
            {waitingDays(row)}d
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      sortable: true,
      sortValue: (row) => -waitingDays(row),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {STATUS_LABEL[row.status]}
          {row.decisionNote ? ` · ${row.decisionNote}` : ""}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.status,
    },
    {
      key: "actions",
      header: "",
      render: (row) =>
        row.status === "pending" ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={decide.isPending}
              onClick={() => approve(row)}
            >
              <Check className="size-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={decide.isPending}
              onClick={() => setRejecting(row)}
            >
              <X className="size-3.5" />
              Refuse
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
        searchPlaceholder="Search requests"
        searchValue={(row) => `${row.userName} ${row.reason}`}
        filters={[
          {
            key: "status",
            label: "Status",
            options: STATUSES.map((s) => ({
              value: s,
              label: STATUS_LABEL[s],
            })),
            matches: (row, value) => row.status === value,
          },
        ]}
        emptyTitle="No deactivation requests"
        emptyDescription="Nobody has asked to close their account."
        emptyIcon={UserMinus}
      />

      <RejectReasonDialog
        open={Boolean(rejecting)}
        onOpenChange={(open) => !open && setRejecting(null)}
        title={`Refuse ${rejecting?.userName ?? ""}'s closure`}
        description="The artist sees this reason on their settings page, and can ask again."
        presets={REJECT_PRESETS}
        confirmLabel="Refuse closure"
        isPending={decide.isPending}
        onSubmit={reject}
      />
    </>
  );
}
