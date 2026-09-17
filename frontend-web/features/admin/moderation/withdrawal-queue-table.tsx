"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Check, TriangleAlert, X } from "lucide-react";
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
import { RejectReasonDialog } from "@/features/admin/reject-reason-dialog";
import {
  useAdminWithdrawals,
  useApproveWithdrawalMutation,
  useRejectWithdrawalMutation,
} from "@/hooks/useAdminModeration";
import { useAdminAuditStore } from "@/store/useAdminAuditStore";
import { useAdminSettings } from "@/hooks/useAdminSystem";
import { formatINR } from "@/lib/utils";
import type { WithdrawalRequest, WithdrawalStatus } from "@/types/admin";

const REJECT_PRESETS = [
  "Bank details could not be verified",
  "KYC not complete for this account",
  "Requested amount exceeds available balance",
  "Suspected duplicate request",
];

const STATUSES: WithdrawalStatus[] = [
  "pending",
  "completed",
  "rejected",
  "failed",
];

function waitingDays(row: WithdrawalRequest): number {
  return Math.max(
    0,
    Math.round(
      (Date.now() - new Date(row.requestedAt).getTime()) /
        86_400_000,
    ),
  );
}

export function WithdrawalQueueTable() {
  const minWithdrawal = useAdminSettings().data?.minWithdrawalAmount ?? 1000;
  const { data: withdrawals, isPending } = useAdminWithdrawals();
  const [active, setActive] = useState<WithdrawalRequest | null>(null);

  const columns: AdminDataTableColumn<WithdrawalRequest>[] = [
    {
      key: "user",
      header: "Requested by",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.userName}
          </p>
          <p className="text-xs capitalize text-muted-foreground">
            {row.userRole}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.userName,
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => (
        <span className="text-sm font-medium tabular-nums text-foreground">
          {formatINR(row.amount)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.amount,
    },
    {
      key: "balance",
      header: "Wallet balance",
      render: (row) => {
        const insufficient = row.amount > row.walletBalance;
        return (
          <span
            className={`text-sm tabular-nums ${insufficient ? "font-medium text-destructive" : "text-muted-foreground"}`}
          >
            {formatINR(row.walletBalance)}
          </span>
        );
      },
      sortable: true,
      sortValue: (row) => row.walletBalance,
    },
    {
      key: "bank",
      header: "Bank",
      render: (row) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {row.bankAccountMasked}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <AdminStatusBadge status={row.status} size="sm" />,
      sortable: true,
      sortValue: (row) => row.status,
    },
    {
      key: "waiting",
      header: "Requested",
      render: (row) => {
        const days = waitingDays(row);
        return (
          <span className="text-sm tabular-nums text-muted-foreground">
            {days === 0 ? "Today" : `${days}d ago`}
          </span>
        );
      },
      sortable: true,
      sortValue: (row) => waitingDays(row),
    },
    {
      key: "action",
      header: "",
      render: (row) =>
        row.status === "pending" ? (
          <Button size="sm" variant="outline" onClick={() => setActive(row)}>
            Review
          </Button>
        ) : null,
      className: "text-right",
    },
  ];

  return (
    <>
      <AdminDataTable
        rows={withdrawals ?? []}
        columns={columns}
        isLoading={isPending}
        getRowKey={(row) => row.id}
        onRowClick={(row) => row.status === "pending" && setActive(row)}
        searchPlaceholder="Search by name"
        searchValue={(row) => row.userName}
        filters={[
          {
            key: "status",
            label: "Status",
            options: STATUSES.map((s) => ({
              value: s,
              label: adminStatusLabel(s),
            })),
            matches: (row, value) => row.status === value,
            // Opens on the work that needs doing, while still offering the full list.
            defaultValue: "pending",
          },
        ]}
        emptyTitle="No withdrawals waiting"
        emptyDescription="Every payout request in this view has been handled."
        emptyIcon={Banknote}
      />

      <WithdrawalReviewDialog
        request={active}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function WithdrawalReviewDialog({
  request,
  onClose,
}: {
  request: WithdrawalRequest | null;
  onClose: () => void;
}) {
  const minWithdrawal = useAdminSettings().data?.minWithdrawalAmount ?? 1000;
  const adminName = useCurrentUser().data?.name ?? "Admin";
  const queryClient = useQueryClient();
  const appendAudit = useAdminAuditStore((s) => s.append);
  const approveMutation = useApproveWithdrawalMutation();
  const rejectMutation = useRejectWithdrawalMutation();
  const [rejectOpen, setRejectOpen] = useState(false);

  const isBusy = approveMutation.isPending || rejectMutation.isPending;
  const insufficient = request ? request.amount > request.walletBalance : false;
  const belowMinimum = request
    ? request.amount < minWithdrawal
    : false;

  function patchStatus(id: string, status: WithdrawalStatus) {
    queryClient.setQueryData<WithdrawalRequest[]>(
      ["admin-withdrawals"],
      (prev) =>
        (prev ?? []).map((w) =>
          w.id === id
            ? { ...w, status, processedAt: new Date().toISOString() }
            : w,
        ),
    );
  }

  async function handleApprove() {
    if (!request) return;
    try {
      await approveMutation.mutateAsync(request.id);
      patchStatus(request.id, "completed");
      appendAudit({
        adminName: adminName,
        action: "withdrawal.approved",
        entityType: "withdrawal",
        entityId: request.id,
        entityLabel: `${request.userName} · ${formatINR(request.amount)}`,
      });
      toast.success("Withdrawal approved", {
        description: `${formatINR(request.amount)} released to ${request.userName}.`,
      });
      onClose();
    } catch {
      toast.error("Could not approve withdrawal. Try again.");
    }
  }

  async function handleReject(reason: string) {
    if (!request) return;
    try {
      await rejectMutation.mutateAsync({ withdrawalId: request.id, reason });
      patchStatus(request.id, "rejected");
      appendAudit({
        adminName: adminName,
        action: "withdrawal.rejected",
        entityType: "withdrawal",
        entityId: request.id,
        entityLabel: `${request.userName} · ${formatINR(request.amount)}`,
        detail: reason,
      });
      setRejectOpen(false);
      toast.success("Withdrawal rejected", {
        description: "The funds stay in the wallet.",
      });
      onClose();
    } catch {
      toast.error("Could not reject withdrawal. Try again.");
    }
  }

  return (
    <>
      <Dialog
        open={Boolean(request) && !rejectOpen}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent className="max-w-lg">
          {request ? (
            <>
              <DialogHeader>
                <DialogTitle>Withdrawal request</DialogTitle>
              </DialogHeader>

              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Amount requested
                </p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
                  {formatINR(request.amount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Available balance {formatINR(request.walletBalance)}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-4">
                <Field label="Requested by" value={request.userName} />
                <Field
                  label="Role"
                  value={request.userRole}
                  className="capitalize"
                />
                <Field
                  label="Bank account"
                  value={request.bankAccountMasked}
                  mono
                />
                <Field
                  label="Minimum payout"
                  value={formatINR(minWithdrawal)}
                />
              </dl>

              {insufficient ? (
                <p className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/[0.06] p-3 text-xs text-foreground">
                  <TriangleAlert className="mt-px size-3.5 shrink-0 text-destructive" />
                  Requested amount exceeds the available wallet balance.
                  Approving this would overdraw the account.
                </p>
              ) : null}

              {belowMinimum ? (
                <p className="flex items-start gap-2 rounded-md border border-gold/40 bg-gold/[0.06] p-3 text-xs text-muted-foreground">
                  <TriangleAlert className="mt-px size-3.5 shrink-0 text-gold-bright" />
                  Below the platform minimum payout.
                </p>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={handleApprove}
                  disabled={isBusy}
                  className="flex-1"
                >
                  <Check className="size-4" />
                  {approveMutation.isPending ? "Approving…" : "Approve payout"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={isBusy}
                  className="flex-1"
                >
                  <X className="size-4" />
                  Reject
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <RejectReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this withdrawal?"
        description="The requester sees this reason. Funds stay in their wallet."
        presets={REJECT_PRESETS}
        isPending={rejectMutation.isPending}
        onSubmit={handleReject}
      />
    </>
  );
}

function Field({
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
