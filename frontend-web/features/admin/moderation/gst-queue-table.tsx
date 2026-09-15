"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt, Check, ExternalLink, X } from "lucide-react";
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
  useAdminGstQueue,
  useApproveGstMutation,
  useRejectGstMutation,
} from "@/hooks/useAdminModeration";
import { useAdminAuditStore } from "@/store/useAdminAuditStore";
import type { AdminUser } from "@/types/admin";

const REJECT_PRESETS = [
  "GSTIN does not match the registered business name",
  "GSTIN appears invalid or inactive",
  "Registration certificate not on file",
];

export function GstQueueTable() {
  const { data: queue, isPending } = useAdminGstQueue();
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
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      key: "gstin",
      header: "GSTIN",
      render: (row) => (
        <span className="font-mono text-sm text-foreground">
          {row.gstin ?? "—"}
        </span>
      ),
    },
    {
      key: "gstStatus",
      header: "Status",
      render: (row) =>
        row.gstStatus ? (
          <AdminStatusBadge status={row.gstStatus} size="sm" />
        ) : null,
      sortable: true,
      sortValue: (row) => row.gstStatus ?? "",
    },
    {
      key: "action",
      header: "",
      render: (row) => (
        <Button size="sm" variant="outline" onClick={() => setActive(row)}>
          Review
        </Button>
      ),
      className: "text-right",
    },
  ];

  return (
    <>
      <AdminDataTable
        rows={queue ?? []}
        columns={columns}
        isLoading={isPending}
        getRowKey={(row) => row.id}
        onRowClick={(row) => setActive(row)}
        searchPlaceholder="Search by name or email"
        searchValue={(row) => `${row.name} ${row.email}`}
        emptyTitle="No GST applications waiting"
        emptyDescription="Every submitted GSTIN has been reviewed."
        emptyIcon={Receipt}
      />

      <GstReviewDialog user={active} onClose={() => setActive(null)} />
    </>
  );
}

function GstReviewDialog({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) {
  const adminName = useCurrentUser().data?.name ?? "Admin";
  const queryClient = useQueryClient();
  const appendAudit = useAdminAuditStore((s) => s.append);
  const approveMutation = useApproveGstMutation();
  const rejectMutation = useRejectGstMutation();
  const [rejectOpen, setRejectOpen] = useState(false);

  const isBusy = approveMutation.isPending || rejectMutation.isPending;

  function dropFromQueue(userId: string) {
    queryClient.setQueryData<AdminUser[]>(["admin-gst-queue"], (prev) =>
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
        action: "gst.approved",
        entityType: "user",
        entityId: user.id,
        entityLabel: user.name,
      });
      toast.success("GST approved", {
        description: `${user.name} can now list artwork.`,
      });
      onClose();
    } catch {
      toast.error("Could not approve GST. Try again.");
    }
  }

  async function handleReject(reason: string) {
    if (!user) return;
    try {
      await rejectMutation.mutateAsync({ userId: user.id, reason });
      dropFromQueue(user.id);
      appendAudit({
        adminName: adminName,
        action: "gst.rejected",
        entityType: "user",
        entityId: user.id,
        entityLabel: user.name,
        detail: reason,
      });
      setRejectOpen(false);
      toast.success("GST rejected", {
        description: "They can resubmit their GSTIN.",
      });
      onClose();
    } catch {
      toast.error("Could not reject GST. Try again.");
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
                <DialogTitle>Verify {user.name}&rsquo;s GST</DialogTitle>
              </DialogHeader>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-4">
                <Field label="Email" value={user.email} />
                <Field label="Phone" value={user.phone} />
                <Field
                  label="GSTIN"
                  value={user.gstin ?? "Not set"}
                  className="font-mono"
                />
                <Field
                  label="Current status"
                  value={user.gstStatus ?? "Not set"}
                  className="capitalize"
                />
              </dl>

              <a
                href="https://services.gst.gov.in/services/searchtp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-gold-bright hover:underline"
              >
                <ExternalLink className="size-3.5" />
                Verify this GSTIN on the government portal
              </a>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={handleApprove}
                  disabled={isBusy}
                  className="flex-1"
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
        title={
          user
            ? `Reject ${user.name}'s GST application?`
            : "Reject GST application?"
        }
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
