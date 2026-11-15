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
import { formatINR } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types/order";

type ArtistOrderRow = Order & { artistPayout: number };

// Artist-side filter: pending is a transient checkout state that the
// customer sees in their own cart flow; cancelled is a buyer-abandoned
// attempt. Neither is a sale the artist made — showing them on the Sales
// table is confusing dead weight. Client flag 16 Nov 2026.
const STATUSES: OrderStatus[] = [
  "paid",
  "confirmed",
  "packed",
  "transit",
  "delivered",
];

const VISIBLE_TO_ARTIST = new Set<OrderStatus>(STATUSES);

export function OrdersTable() {
  const { data: raw, isPending } = useArtistOrders();
  const orders = raw?.filter((o) => VISIBLE_TO_ARTIST.has(o.status));

  const columns: AdminDataTableColumn<ArtistOrderRow>[] = [
    {
      key: "artwork",
      header: "Artwork",
      render: (row) => {
        const artwork = row.artwork;
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
      sortValue: (row) => row.artwork?.title ?? row.artworkId,
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
        `${row.id} ${row.artwork?.title ?? ""}`
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
