"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Check, ShieldCheck, X } from "lucide-react";
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
  useAdminKycQueue,
  useApproveKycMutation,
  useRejectKycMutation,
} from "@/hooks/useAdminModeration";
import { useAdminAuditStore } from "@/store/useAdminAuditStore";
import type { AdminUser } from "@/types/admin";
import { QueueViewSwitch, ReviewedBy, type QueueView } from "./queue-view";

const REJECT_PRESETS = [
  "Document image unreadable",
  "Name does not match the account holder",
  "Document appears altered",
  "Bank details do not match the submitted identity",
];

function waitingDays(user: AdminUser): number {
  return Math.max(
    0,
    Math.round(
      (Date.now() - new Date(user.createdAt).getTime()) / 86_400_000,
    ),
  );
}

export function KycQueueTable() {
  const [view, setView] = useState<QueueView>("waiting");
  const { data: queue, isPending } = useAdminKycQueue(view);
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
      key: "kycStatus",
      header: "KYC status",
      render: (row) =>
        row.kycStatus ? (
          <AdminStatusBadge status={row.kycStatus} size="sm" />
        ) : null,
      sortable: true,
      sortValue: (row) => row.kycStatus ?? "",
    },
    {
      key: "account",
      header: "Account",
      render: (row) => <AdminStatusBadge status={row.status} size="sm" />,
      sortable: true,
      sortValue: (row) => row.status,
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
      render: (row) => <ReviewedBy name={row.review?.adminName} decision={row.review?.decision} at={row.review?.at} />,
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
        emptyTitle={view === "waiting" ? "No KYC waiting" : "No KYC reviews yet"}
        emptyDescription={view === "waiting" ? "Every submitted identity check has been reviewed." : "Approved and rejected identity checks will be listed here."}
        emptyIcon={BadgeCheck}
      />

      <KycReviewDialog user={active} onClose={() => setActive(null)} />
    </>
  );
}

function KycReviewDialog({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) {
  const adminName = useCurrentUser().data?.name ?? "Admin";
  const queryClient = useQueryClient();
  const appendAudit = useAdminAuditStore((s) => s.append);
  const approveMutation = useApproveKycMutation();
  const rejectMutation = useRejectKycMutation();
  const [rejectOpen, setRejectOpen] = useState(false);

  const isBusy = approveMutation.isPending || rejectMutation.isPending;

  function dropFromQueue(userId: string) {
    queryClient.setQueryData<AdminUser[]>(["admin-kyc-queue"], (prev) =>
      (prev ?? []).filter((u) => u.id !== userId),
    );
  }

  async function handleApprove() {
    if (!user) return;
    try {
      await approveMutation.mutateAsync(user.id);
      dropFromQueue(user.id);
      appendAudit({
        adminName: adminName,
        action: "kyc.approved",
        entityType: "user",
        entityId: user.id,
        entityLabel: user.name,
      });
      toast.success("KYC approved", {
        description: `${user.name} is now verified.`,
      });
      onClose();
    } catch {
      toast.error("Could not approve KYC. Try again.");
    }
  }

  async function handleReject(reason: string) {
    if (!user) return;
    try {
      await rejectMutation.mutateAsync({ userId: user.id, reason });
      dropFromQueue(user.id);
      appendAudit({
        adminName: adminName,
        action: "kyc.rejected",
        entityType: "user",
        entityId: user.id,
        entityLabel: user.name,
        detail: reason,
      });
      setRejectOpen(false);
      toast.success("KYC rejected", {
        description: "They can resubmit their documents.",
      });
      onClose();
    } catch {
      toast.error("Could not reject KYC. Try again.");
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
                <DialogTitle>Verify {user.name}</DialogTitle>
              </DialogHeader>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-4">
                <Field label="Email" value={user.email} />
                <Field label="Phone" value={user.phone} />
                <Field label="Role" value={user.role} className="capitalize" />
                <Field
                  label="Current status"
                  value={user.kycStatus ?? "Not set"}
                  className="capitalize"
                />
              </dl>

              {/* Identity documents are never exposed in full to the console —
                  only the fact that one was submitted, and its verification
                  status. Matches the platform's own data-handling rule.
                  Bank details are checked here (not just left to backend
                  refusal) so the admin knows BEFORE clicking Approve that
                  the artist still has to fill them out. Client flag 19 Nov
                  2026 — "KYC was approvable without bank details, it
                  shouldn't be." */}
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    Aadhaar on file
                  </p>
                  {user.kycStatus === "submitted" || user.kycStatus === "approved" ? (
                    <p className="mt-1 text-sm text-foreground">
                      Verified via DigiLocker
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Not submitted yet
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    Bank account
                  </p>
                  {user.bankAccountMasked ? (
                    <>
                      <p className="mt-1 font-mono text-base tabular-nums text-foreground">
                        {user.bankAccountMasked}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        IFSC {user.ifsc ?? "—"}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-destructive">
                      Not added yet — can&rsquo;t approve until the artist fills the Payout section
                    </p>
                  )}
                </div>

                <p className="flex items-start gap-2 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-px size-3.5 shrink-0 text-gold-bright" />
                  Full identity numbers are never exposed to the console.
                  Approve only once the submitted documents have been checked in
                  the secure viewer.
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={handleApprove}
                  disabled={isBusy || !user.bankAccountMasked || !user.ifsc}
                  className="flex-1"
                  title={
                    !user.bankAccountMasked || !user.ifsc
                      ? "The artist hasn't added bank details yet — approval is gated on both bank account and IFSC."
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
        title={user ? `Reject ${user.name}'s KYC?` : "Reject KYC?"}
        description="They see this reason and can resubmit."
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
