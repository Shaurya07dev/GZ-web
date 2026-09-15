"use client";

import { Users } from "lucide-react";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import {
  AdminStatusBadge,
  adminStatusLabel,
} from "@/features/admin/admin-status-badge";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useArtistRatingsByUserId } from "@/hooks/useArtistRating";
import { StarRating } from "@/components/shared/star-rating";

import type { AdminUser, UserRole, UserStatus } from "@/types/admin";

// ---------------------------------------------------------------------------
// Genuinely shared across /admin/artists, /admin/aggregators and
// /admin/customers, which differ only in which role they filter to and which
// role-specific column they show. This is the opposite call from the shells
// (which are independent copies) precisely because these three ARE the same
// table with different configuration, rather than three things that merely
// look alike today.
// ---------------------------------------------------------------------------

const STATUSES: UserStatus[] = ["pending", "active", "suspended", "blocked"];

const DETAIL_BASE: Record<Exclude<UserRole, "admin">, string> = {
  artist: "/admin/artists",
  aggregator: "/admin/aggregators",
  customer: "/admin/customers",
};

function joinedDays(user: AdminUser): number {
  return Math.max(
    0,
    Math.round(
      (Date.now() - new Date(user.createdAt).getTime()) / 86_400_000,
    ),
  );
}

function formatJoined(user: AdminUser): string {
  return new Date(user.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function UserTable({ role }: { role: Exclude<UserRole, "admin"> }) {
  const { data: users, isPending } = useAdminUsers(role);
  const rows = users ?? [];

  // Ratings are fetched for the whole page of artists in one call rather than
  // one per row — the table renders every artist at once, so a per-row query
  // would be one request per artist for a single column.
  const { data: ratings } = useArtistRatingsByUserId(
    role === "artist" ? rows.map((row) => row.id) : [],
  );

  const identityColumn: AdminDataTableColumn<AdminUser> = {
    key: "name",
    header: role === "aggregator" ? "Company" : "Name",
    render: (row) => (
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {role === "aggregator" ? (row.companyName ?? row.name) : row.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
      </div>
    ),
    sortable: true,
    sortValue: (row) =>
      role === "aggregator" ? (row.companyName ?? row.name) : row.name,
  };

  const roleSpecific: AdminDataTableColumn<AdminUser>[] =
    role === "artist"
      ? [
          {
            key: "kyc",
            header: "KYC",
            render: (row) =>
              row.kycStatus ? (
                <AdminStatusBadge status={row.kycStatus} size="sm" />
              ) : (
                <span className="text-xs text-muted-foreground">Not set</span>
              ),
            sortable: true,
            sortValue: (row) => row.kycStatus ?? "",
          },
          {
            key: "rating",
            header: "Rating",
            render: (row) => {
              const rating = ratings?.[row.id];
              if (!rating || rating.count === 0) {
                return (
                  <span className="text-xs text-muted-foreground">
                    No ratings
                  </span>
                );
              }
              return (
                <span className="flex items-center gap-2">
                  <StarRating value={rating.average} size="sm" />
                  <span className="text-sm tabular-nums text-foreground">
                    {rating.average.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    ({rating.count})
                  </span>
                </span>
              );
            },
            sortable: true,
            // Unrated artists sort last either way rather than tying with a
            // genuine 0.0, which no review can produce (the scale starts at 1).
            sortValue: (row) => -(ratings?.[row.id]?.average ?? 0),
          },
        ]
      : role === "aggregator"
        ? [
            {
              key: "contact",
              header: "Contact",
              render: (row) => (
                <span className="text-sm text-muted-foreground">
                  {row.name}
                </span>
              ),
              sortable: true,
              sortValue: (row) => row.name,
            },
          ]
        : [
            {
              key: "phone",
              header: "Phone",
              render: (row) => (
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {row.phone}
                </span>
              ),
            },
          ];

  const columns: AdminDataTableColumn<AdminUser>[] = [
    identityColumn,
    ...roleSpecific,
    {
      key: "status",
      header: "Status",
      render: (row) => <AdminStatusBadge status={row.status} size="sm" />,
      sortable: true,
      sortValue: (row) => row.status,
    },
    {
      key: "joined",
      header: "Joined",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatJoined(row)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => -joinedDays(row),
    },
  ];

  const label = role === "aggregator" ? "aggregators" : `${role}s`;

  return (
    <AdminDataTable
      rows={rows}
      columns={columns}
      isLoading={isPending}
      getRowKey={(row) => row.id}
      getRowHref={(row) => `${DETAIL_BASE[role]}/${row.id}`}
      getRowLabel={(row) => `Open ${row.name}`}
      searchPlaceholder={`Search ${label}`}
      searchValue={(row) => `${row.name} ${row.email} ${row.companyName ?? ""}`}
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
      emptyTitle={`No ${label}`}
      emptyDescription="Nothing matches the current filters."
      emptyIcon={Users}
    />
  );
}
