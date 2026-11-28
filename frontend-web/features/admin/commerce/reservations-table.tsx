"use client";

import { Lock, Package } from "lucide-react";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import { useAdminReservations } from "@/hooks/useAdminReservations";
import { formatINR } from "@/lib/utils";
import type { AdminReservationRow } from "@/services/adminReservationsService";

export function ReservationsTable() {
  const { data, isPending } = useAdminReservations();
  const rows = data?.rows ?? [];

  const totalEscrow = rows.reduce((sum, r) => sum + r.escrowedPaise, 0);

  const columns: AdminDataTableColumn<AdminReservationRow>[] = [
    {
      key: "artwork",
      header: "Artwork",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.artworkTitle}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            by {row.artistName}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.artworkTitle,
    },
    {
      key: "aggregator",
      header: "Reserved by",
      render: (row) => (
        <span className="text-sm text-foreground">{row.aggregatorName}</span>
      ),
      sortable: true,
      sortValue: (row) => row.aggregatorName,
    },
    {
      key: "advance",
      header: "Advance",
      render: (row) => (
        <span className="font-mono text-sm tabular-nums text-foreground">
          {formatINR(row.advancePaise / 100)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.advancePaise,
    },
    {
      key: "delivery",
      header: "Delivery deposit",
      render: (row) => (
        <span className="font-mono text-sm tabular-nums text-foreground">
          {formatINR(row.deliveryDepositPaise / 100)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.deliveryDepositPaise,
    },
    {
      key: "escrowed",
      header: "In escrow",
      render: (row) => (
        <span className="font-mono text-sm font-medium tabular-nums text-gold-bright">
          {formatINR(row.escrowedPaise / 100)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.escrowedPaise,
    },
    {
      key: "displayPrice",
      header: "Display price",
      render: (row) => (
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {formatINR(row.displayPricePaise / 100)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.displayPricePaise,
    },
    {
      key: "paymentId",
      header: "Razorpay payment",
      render: (row) =>
        row.providerPaymentId ? (
          <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">
            {row.providerPaymentId}
          </code>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "window",
      header: "Window",
      render: (row) => (
        <div className="text-xs">
          <p className="text-foreground">
            Day{row.cycleMonth === 1 ? "" : "s"} in cycle {row.cycleMonth}/5
          </p>
          <p className="text-muted-foreground">
            {row.daysLeft} day{row.daysLeft === 1 ? "" : "s"} left
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.daysLeft,
    },
  ];

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-gold/30 bg-gold/5 px-4 py-3">
          <Lock className="size-4 text-gold-bright" aria-hidden />
          <p className="text-sm text-foreground">
            Total escrowed across {rows.length} active reservation
            {rows.length === 1 ? "" : "s"}:{" "}
            <span className="font-mono font-semibold tabular-nums text-gold-bright">
              {formatINR(totalEscrow / 100)}
            </span>
          </p>
        </div>
      )}

      <AdminDataTable
        rows={rows}
        columns={columns}
        isLoading={isPending}
        getRowKey={(row) => row.holdingId}
        searchPlaceholder="Search by artwork, aggregator, or payment id"
        searchValue={(row) =>
          `${row.artworkTitle} ${row.aggregatorName} ${row.artistName} ${row.providerPaymentId ?? ""}`
        }
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "reserved", label: "Reserved" },
              { value: "sold_pending_settlement", label: "Sold, settlement pending" },
            ],
            matches: (row, value) => row.status === value,
          },
        ]}
        emptyTitle="No active reservations"
        emptyDescription="When an aggregator reserves a piece and the Razorpay payment captures, it shows up here with the full money flow."
        emptyIcon={Package}
      />
    </div>
  );
}
