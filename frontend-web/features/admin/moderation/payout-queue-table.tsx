"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Check, Wallet } from "lucide-react";
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
import { AdminStatusBadge } from "@/features/admin/admin-status-badge";
import { RejectReasonDialog } from "@/features/admin/reject-reason-dialog";
import {
  useAdminPayoutQueue,
  useApprovePayoutMutation,
  useRejectPayoutMutation,
} from "@/hooks/useAdminModeration";
import { useAdminAuditStore } from "@/store/useAdminAuditStore";
import type { AdminUser } from "@/types/admin";
import { QueueViewSwitch, ReviewedBy, type QueueView } from "./queue-view";

// Reasons the admin might refuse a payout destination. Different vocabulary
// from the KYC rejections: those were about identity documents, these are
// about the bank destination itself.
const REJECT_PRESETS = [
  "Account holder name doesn't match the submitted identity",
  "IFSC doesn't match the bank account",
  "Account number looks invalid",
  "Need to see a bank statement or passbook before approving",
];

function waitingDays(user: AdminUser): number {
  return Math.max(
    0,
    Math.round(
      (Date.now() - new Date(user.createdAt).getTime()) / 86_400_000,
    ),
  );
}

function payoutBadge(
  status: AdminUser["payoutStatus"],
): "pending" | "submitted" | "approved" | "rejected" {
  // Reuse admin-status-badge's vocabulary. Treat "not_submitted" as "pending"
  // visually — the artist still has to add bank details.
  if (status === "submitted") return "submitted";
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

export function PayoutQueueTable() {
  const [view, setView] = useState<QueueView>("waiting");
  const { data: queue, isPending } = useAdminPayoutQueue(view);
  const [active, setActive] = useState<AdminUser | null>(null);

  const columns: AdminDataTableColumn<AdminUser>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.email} · <span className="capitalize">{row.role}</span>
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      key: "bank",
      header: "Bank account",
      render: (row) =>
        row.bankAccountMasked ? (
          <div className="min-w-0">
            <p className="font-mono text-sm text-foreground tabular-nums">
              {row.bankAccountMasked}
            </p>
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              IFSC {row.ifsc ?? "—"}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            Not added yet
          </span>
        ),
    },
    {
      key: "payoutStatus",
      header: "Payout status",
      render: (row) => (
        <AdminStatusBadge status={payoutBadge(row.payoutStatus)} size="sm" />
      ),
      sortable: true,
      sortValue: (row) => row.payoutStatus ?? "",
    },
    {
      key: "waiting",
      header: "Waiting",
      render: (row) => {
        const days = waitingDays(row);
        return (
          <span
            className={`text-sm tabular-nums ${days >= 7 ? "font-medium text-gold-bright" : "text-muted-foreground"}`}
          >
            {days === 0 ? "Today" : `${days}d`}
          </span>
        );
      },
      sortable: true,
      sortValue: (row) => waitingDays(row),
    },
    {
      key: "reviewedBy",
      header: "Reviewed by",
      render: (row) => (
        <ReviewedBy
          name={row.review?.adminName}
          decision={row.review?.decision}
          at={row.review?.at}
        />
      ),
      sortable: true,
      sortValue: (row) => row.review?.at ?? "",
    },
    {
      key: "action",
      header: "",
      render: (row) =>
        view === "waiting" ? (
          <Button size="sm" variant="outline" onClick={() => setActive(row)}>
            Review
          </Button>
        ) : null,
      className: "text-right",
    },
  ];

  return (
    <>
      <QueueViewSwitch value={view} onChange={setView} />
      <AdminDataTable
        rows={queue ?? []}
        columns={columns}
        isLoading={isPending}
        getRowKey={(row) => row.id}
        onRowClick={view === "waiting" ? (row) => setActive(row) : undefined}
        searchPlaceholder="Search by name or email"
        searchValue={(row) => `${row.name} ${row.email}`}
        emptyTitle={
          view === "waiting" ? "No payout approvals waiting" : "No payout reviews yet"
        }
        emptyDescription={
          view === "waiting"
            ? "Every submitted bank-account pair has been reviewed."
            : "Approved and rejected payout destinations will be listed here."
        }
        emptyIcon={Banknote}
      />

      <PayoutReviewDialog user={active} onClose={() => setActive(null)} />
    </>
  );
}

function PayoutReviewDialog({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) {
  const adminName = useCurrentUser().data?.name ?? "Admin";
  const queryClient = useQueryClient();
  const appendAudit = useAdminAuditStore((s) => s.append);
  const approveMutation = useApprovePayoutMutation();
  const rejectMutation = useRejectPayoutMutation();
  const [rejectOpen, setRejectOpen] = useState(false);

  const isBusy = approveMutation.isPending || rejectMutation.isPending;
  const hasBank = Boolean(user?.bankAccountMasked);
  const hasIfsc = Boolean(user?.ifsc);
  const canApprove = hasBank && hasIfsc;

  function dropFromQueue(userId: string) {
    queryClient.setQueryData<AdminUser[]>(["admin-payout-queue"], (prev) =>
      (prev ?? []).filter((u) => u.id !== userId),
    );
  }

  async function handleApprove() {
    if (!user) return;
    try {
      await approveMutation.mutateAsync(user.id);
      dropFromQueue(user.id);
      appendAudit({
        adminName,
        action: "payout.approved",
        entityType: "user",
        entityId: user.id,
        entityLabel: user.name,
      });
      toast.success("Payout approved", {
        description: `${user.name} can now receive settlements.`,
      });
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not approve payout. Try again.",
      );
    }
  }

  async function handleReject(reason: string) {
    if (!user) return;
    try {
      await rejectMutation.mutateAsync({ userId: user.id, reason });
      dropFromQueue(user.id);
      appendAudit({
        adminName,
        action: "payout.rejected",
        entityType: "user",
        entityId: user.id,
        entityLabel: user.name,
        detail: reason,
      });
      setRejectOpen(false);
      toast.success("Payout rejected", {
        description: "They can resubmit their bank details.",
      });
      onClose();
    } catch {
      toast.error("Could not reject payout. Try again.");
    }
  }

  return (
    <>
      <Dialog
        open={Boolean(user) && !rejectOpen}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent className="max-w-lg">
          {user ? (
            <>
              <DialogHeader>
                <DialogTitle>Approve payout for {user.name}</DialogTitle>
              </DialogHeader>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-4">
                <Field label="Email" value={user.email} />
                <Field label="Phone" value={user.phone} />
                <Field label="Role" value={user.role} className="capitalize" />
                <Field
                  label="Current status"
                  value={user.payoutStatus ?? "not_submitted"}
                  className="capitalize"
                />
              </dl>

              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="size-3.5 text-gold-bright" />
                    <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                      Bank destination
                    </p>
                  </div>
                  {hasBank ? (
                    <>
                      <p className="mt-2 font-mono text-base tabular-nums text-foreground">
                        {user.bankAccountMasked}
                      </p>
                      <p className="mt-0.5 font-mono text-sm text-muted-foreground tabular-nums">
                        IFSC {user.ifsc ?? "—"}
                      </p>
                      {!hasIfsc ? (
                        <p className="mt-2 text-xs text-destructive">
                          IFSC is missing. Ask the artist to add it before you
                          approve.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-destructive">
                      Not added yet. The artist still needs to fill the Payout
                      section in their profile.
                    </p>
                  )}
                </div>

                <p className="flex items-start gap-2 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
                  <Banknote className="mt-px size-3.5 shrink-0 text-gold-bright" />
                  Full account numbers never appear here — only the last four
                  digits. Approve only once you&rsquo;ve seen a passbook, cheque
                  or bank statement matching the identity on file.
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={handleApprove}
                  disabled={isBusy || !canApprove}
                  className="flex-1"
                  title={
                    !canApprove
                      ? "Both bank account and IFSC must be on file before approval."
                      : undefined
                  }
                >
                  <Check className="size-4" />
                  {approveMutation.isPending ? "Approving…" : "Approve"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={isBusy}
                  className="flex-1"
                >
                  Reject with reason
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <RejectReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={`Reject payout for ${user?.name ?? ""}`}
        description="The artist sees this message in their profile and can resubmit their bank details once corrected."
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
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`truncate text-sm text-foreground ${className ?? ""}`}>
        {value}
      </dd>
    </div>
  );
}
