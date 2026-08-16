"use client";

import { Users } from "lucide-react";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import { formatINR } from "@/lib/utils";
import { useAggregatorCustomers } from "@/hooks/useAggregatorCustomers";
import type { AggregatorCustomer } from "@/services/aggregatorSalesService";

export function CustomersTable() {
  const { data: customers, isPending } = useAggregatorCustomers();

  const columns: AdminDataTableColumn<AggregatorCustomer>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <p className="text-sm font-medium text-foreground">
          {row.buyerName}
        </p>
      ),
      sortable: true,
      sortValue: (row) => row.buyerName,
    },
    {
      key: "email",
      header: "Email",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.buyerEmail}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.buyerEmail,
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.buyerPhone}
        </span>
      ),
    },
    {
      key: "orderCount",
      header: "Orders",
      render: (row) => (
        <span className="text-sm tabular-nums text-foreground">
          {row.orderCount}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.orderCount,
    },
    {
      key: "totalSpend",
      header: "Total spend",
      render: (row) => (
        <span className="text-sm font-medium tabular-nums text-foreground">
          {formatINR(row.totalSpend)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.totalSpend,
    },
  ];

  return (
    <AdminDataTable
      rows={customers ?? []}
      columns={columns}
      isLoading={isPending}
      getRowKey={(row) => row.buyerEmail}
      searchPlaceholder="Search by name or email"
      searchValue={(row) => `${row.buyerName} ${row.buyerEmail}`}
      emptyTitle="No customers yet"
      emptyDescription="Buyers from your recorded sales will show up here."
      emptyIcon={Users}
    />
  );
}
