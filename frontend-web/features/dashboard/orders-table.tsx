"use client";

import { ShoppingBag } from "lucide-react";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import {
  AdminStatusBadge,
  adminStatusLabel,
} from "@/features/admin/admin-status-badge";
import { useArtistOrders } from "@/hooks/useArtistOrders";
import { getArtworkById } from "@/lib/mock-data/helpers";
import { formatINR } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types/order";

type ArtistOrderRow = Order & { artistPayout: number };

const STATUSES: OrderStatus[] = [
  "pending",
  "paid",
  "confirmed",
  "packed",
  "transit",
  "delivered",
  "cancelled",
];

export function OrdersTable() {
  const { data: orders, isPending } = useArtistOrders();

  const columns: AdminDataTableColumn<ArtistOrderRow>[] = [
    {
      key: "artwork",
      header: "Artwork",
      render: (row) => {
        const artwork = getArtworkById(row.artworkId);
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {artwork?.title ?? row.artworkId}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Order {row.id}
            </p>
          </div>
        );
      },
      sortable: true,
      sortValue: (row) => getArtworkById(row.artworkId)?.title ?? row.artworkId,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <AdminStatusBadge status={row.status} size="sm" />,
      sortable: true,
      sortValue: (row) => row.status,
    },
    {
      key: "payout",
      header: "Your payout",
      render: (row) => (
        <span className="text-sm font-medium tabular-nums text-foreground">
          {formatINR(row.artistPayout)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.artistPayout,
    },
    {
      key: "placed",
      header: "Placed",
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
  ];

  return (
    <AdminDataTable
      rows={orders ?? []}
      columns={columns}
      isLoading={isPending}
      getRowKey={(row) => row.id}
      searchPlaceholder="Search by artwork or order id"
      searchValue={(row) =>
        `${row.id} ${getArtworkById(row.artworkId)?.title ?? ""}`
      }
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
      emptyTitle="No orders yet"
      emptyDescription="Sold pieces and their fulfillment status will show up here."
      emptyIcon={ShoppingBag}
    />
  );
}
