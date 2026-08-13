"use client";

import { useMemo } from "react";
import { Lock, ScrollText } from "lucide-react";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import { useAdminAuditLog } from "@/hooks/useAdminSystem";
import { useAdminAuditStore } from "@/store/useAdminAuditStore";
import { ADMIN_TODAY } from "@/features/admin/admin-data";
import type { AuditAction, AuditLogEntry } from "@/types/admin";

// ---------------------------------------------------------------------------
// Read-only by construction. There is no edit or delete affordance anywhere in
// this component, and there is no service method behind one either — the
// platform's own rule is that audit rows are immutable and server-written, so
// a UI that implied otherwise would be lying about what the system does.
// ---------------------------------------------------------------------------

const ACTION_LABEL: Record<AuditAction, string> = {
  "artwork.approved": "Artwork approved",
  "artwork.rejected": "Artwork rejected",
  "artwork.delisted": "Artwork delisted",
  "kyc.approved": "KYC approved",
  "kyc.rejected": "KYC rejected",
  "withdrawal.approved": "Withdrawal approved",
  "withdrawal.rejected": "Withdrawal rejected",
  "user.suspended": "User suspended",
  "user.activated": "User reactivated",
  "category.created": "Category created",
  "category.updated": "Category updated",
  "category.deleted": "Category deleted",
  "settlement.retried": "Settlement retried",
  "settings.updated": "Settings updated",
};

const NEGATIVE_ACTIONS = new Set<AuditAction>([
  "artwork.rejected",
  "artwork.delisted",
  "kyc.rejected",
  "withdrawal.rejected",
  "user.suspended",
  "category.deleted",
]);

const ENTITY_TYPES = [
  "artwork",
  "user",
  "withdrawal",
  "category",
  "settlement",
  "settings",
] as const;

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === ADMIN_TODAY.toDateString();
  return date.toLocaleString("en-IN", {
    day: sameDay ? undefined : "numeric",
    month: sameDay ? undefined : "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function AuditLogTable() {
  const { data: seeded, isPending } = useAdminAuditLog();
  const sessionEntries = useAdminAuditStore((s) => s.entries);

  // Session actions first, then the seeded history. Anything you just did in
  // this console shows up at the top, which is the whole point.
  const rows = useMemo<AuditLogEntry[]>(
    () => [...sessionEntries, ...(seeded ?? [])],
    [sessionEntries, seeded],
  );

  const columns: AdminDataTableColumn<AuditLogEntry>[] = [
    {
      key: "when",
      header: "When",
      render: (row) => (
        <time
          dateTime={row.createdAt}
          className="text-sm tabular-nums text-muted-foreground"
        >
          {formatWhen(row.createdAt)}
        </time>
      ),
      sortable: true,
      sortValue: (row) => -new Date(row.createdAt).getTime(),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
            NEGATIVE_ACTIONS.has(row.action)
              ? "border-destructive/40 bg-destructive/[0.07] text-destructive"
              : "border-border bg-muted text-foreground"
          }`}
        >
          {ACTION_LABEL[row.action]}
        </span>
      ),
      sortable: true,
      sortValue: (row) => ACTION_LABEL[row.action],
    },
    {
      key: "entity",
      header: "Subject",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{row.entityLabel}</p>
          <p className="text-xs capitalize text-muted-foreground">
            {row.entityType}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.entityLabel,
    },
    {
      key: "detail",
      header: "Detail",
      render: (row) =>
        row.detail ? (
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {row.detail}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">No detail</span>
        ),
    },
    {
      key: "admin",
      header: "By",
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.adminName}</span>
      ),
      sortable: true,
      sortValue: (row) => row.adminName,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Lock className="mt-px size-3.5 shrink-0" />
        Audit entries are immutable by design. Nothing here can be edited or
        removed, including by an administrator.
      </p>

      <AdminDataTable
        rows={rows}
        columns={columns}
        isLoading={isPending}
        getRowKey={(row) => row.id}
        searchPlaceholder="Search subject or detail"
        searchValue={(row) =>
          `${row.entityLabel} ${row.detail ?? ""} ${row.adminName}`
        }
        pageSize={20}
        filters={[
          {
            key: "action",
            label: "Action",
            options: (Object.keys(ACTION_LABEL) as AuditAction[]).map((a) => ({
              value: a,
              label: ACTION_LABEL[a],
            })),
            matches: (row, value) => row.action === value,
          },
          {
            key: "entityType",
            label: "Subject type",
            options: ENTITY_TYPES.map((t) => ({
              value: t,
              label: t.charAt(0).toUpperCase() + t.slice(1),
            })),
            matches: (row, value) => row.entityType === value,
          },
        ]}
        emptyTitle="No audit entries"
        emptyDescription="Nothing matches the current filters."
        emptyIcon={ScrollText}
      />
    </div>
  );
}
