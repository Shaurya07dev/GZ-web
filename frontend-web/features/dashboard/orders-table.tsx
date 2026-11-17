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

/** Human label for the four Shiprocket courier stages, shown in the
 *  artist's Shipping column so they can see where the parcel is. */
const STAGE_LABEL: Record<string, string> = {
  pickup: "Awaiting pickup",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

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
    // Shipping column — the AWB + carrier so the artist can look up the
    // pickup window with the courier directly. Client flag 16 Nov 2026:
    // the artist portal had no visibility into any shipping fact (AWB,
    // courier, stage, ETA) even though the whole backend tracker was
    // being built on the customer's side.
    {
      key: "shipping",
      header: "Shipping",
      render: (row) => {
        if (!row.shiprocketStage) {
          return <span className="text-xs text-muted-foreground">Not booked</span>;
        }
        return (
          <div className="min-w-0 text-xs">
            <p className="truncate text-foreground">
              {row.carrier ?? "—"}
              {row.trackingId ? (
                <span className="ml-1.5 font-mono text-muted-foreground">
                  AWB {row.trackingId}
                </span>
              ) : null}
            </p>
            <p className="text-muted-foreground">
              {STAGE_LABEL[row.shiprocketStage] ?? row.shiprocketStage}
            </p>
          </div>
        );
      },
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
