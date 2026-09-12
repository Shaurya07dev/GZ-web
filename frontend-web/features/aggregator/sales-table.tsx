"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import { PriceTag } from "@/components/shared/price-tag";
import { getArtworkById } from "@/lib/mock-data/helpers";
import { holdingsCol } from "@/lib/mock-collections";
import { formatINR } from "@/lib/utils";
import { useAggregatorSales } from "@/hooks/useAggregatorSales";
import type { AggregatorSale } from "@/types/aggregator";

const SHIPMENT_STATUSES: AggregatorSale["shipmentStatus"][] = [
  "preparing",
  "dispatched",
  "delivered",
];

const SHIPMENT_LABEL: Record<AggregatorSale["shipmentStatus"], string> = {
  preparing: "Preparing",
  dispatched: "Dispatched",
  delivered: "Delivered",
};

const SHIPMENT_CLASS: Record<AggregatorSale["shipmentStatus"], string> = {
  preparing: "border-gold/35 bg-gold/10 text-gold-bright",
  dispatched: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  delivered: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

// Mirrors aggregatorSalesService's internal commissionForSale (not exported,
// UI-only concern) — 20% of the markup the display price carries over the
// customer-price floor, same formula the Dashboard KPI and recordSale() use.
function commissionForSale(sale: AggregatorSale): number {
  const holding = holdingsCol.get().find((h) => h.id === sale.holdingId);
  const artwork = getArtworkById(sale.artworkId);
  if (!holding || !artwork) return 0;
  return Math.round(
    0.2 * Math.max(0, holding.displayPrice - artwork.customerPrice),
  );
}

export function SalesTable() {
  const { data: sales, isPending } = useAggregatorSales();
  const [active, setActive] = useState<AggregatorSale | null>(null);

  const columns: AdminDataTableColumn<AggregatorSale>[] = [
    {
      key: "artwork",
      header: "Artwork",
      render: (row) => {
        const artwork = getArtworkById(row.artworkId);
        return (
          <div className="flex min-w-0 items-center gap-3">
            {artwork && (
              <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                <Image
                  src={artwork.thumbnailUrl}
                  alt={artwork.title}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </div>
            )}
            <p className="truncate text-sm font-medium text-foreground">
              {artwork?.title ?? row.artworkId}
            </p>
          </div>
        );
      },
      sortable: true,
      sortValue: (row) => getArtworkById(row.artworkId)?.title ?? row.artworkId,
    },
    {
      key: "buyer",
      header: "Buyer",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{row.buyerName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.buyerEmail}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.buyerName,
    },
    {
      key: "soldPrice",
      header: "Sold price",
      render: (row) => <PriceTag amount={row.soldPrice} className="text-sm" />,
      sortable: true,
      sortValue: (row) => row.soldPrice,
    },
    {
      key: "commission",
      header: "Commission",
      render: (row) => (
        <span className="text-sm tabular-nums text-gold-bright">
          {formatINR(commissionForSale(row))}
        </span>
      ),
      sortable: true,
      sortValue: (row) => commissionForSale(row),
    },
    {
      key: "shipmentStatus",
      header: "Shipment",
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${SHIPMENT_CLASS[row.shipmentStatus]}`}
        >
          {SHIPMENT_LABEL[row.shipmentStatus]}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.shipmentStatus,
    },
    {
      key: "soldAt",
      header: "Sold",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.soldAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
      sortable: true,
      sortValue: (row) => -new Date(row.soldAt).getTime(),
    },
  ];

  return (
    <>
      {/* Custom Mobile Layout matching reference */}
      <div className="flex flex-col gap-4 lg:hidden">
        {/* Tabs */}
        <div className="flex w-full items-center gap-1.5 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {["All", "Reservations", "Sold", "Returned"].map((tab, i) => (
            <button
              key={tab}
              className={`shrink-0 rounded-md border px-4 py-1.5 text-[13px] font-medium transition-colors ${
                i === 0
                  ? "border-gold-700 bg-[#9a7b4f] text-white"
                  : "border-border bg-muted/20 text-foreground hover:bg-muted/50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search & Filter Icon */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by buyer or artwork..."
              className="w-full rounded-lg border border-border bg-muted/30 py-2 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all"
            />
          </div>
          <button className="flex shrink-0 size-9 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted">
            <SlidersHorizontal className="size-4" />
          </button>
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {["All Shipment", "All Dates", "All Status"].map((dropdown) => (
            <button
              key={dropdown}
              className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              {dropdown}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Empty State */}
        {(!sales || sales.length === 0) && (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl bg-[#F6F3EC] px-6 py-12 text-center border border-border/50">
            <div className="relative w-32 h-32 mb-4">
              <Image
                src="/images/no_sales_empty_state.jpg"
                alt="No sales yet"
                fill
                className="object-contain mix-blend-multiply brightness-[1.08] contrast-[1.15] sepia-[.2]"
              />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">
              No sales yet
            </h3>
            <p className="mt-2 text-[13px] text-muted-foreground max-w-[280px]">
              Recorded sales from your holdings will show up here. When a
              customer purchases or a reservation is converted to a sale, it
              will appear in this list.
            </p>
            <Button 
              nativeButton={false} 
              render={<Link href="/aggregator/inventory" />} 
              className="mt-6 bg-primary hover:bg-gold-deep text-primary-foreground"
            >
              Browse GalleryZone
            </Button>
            <p className="mt-3 text-[11px] text-muted-foreground max-w-[200px]">
              Discover more artworks to display in your gallery.
            </p>
          </div>
        )}

        {/* Mobile Sales List would go here (omitted for empty state focus or mapped if sales exist) */}
        {sales && sales.length > 0 && (
          <div className="mt-2 flex flex-col gap-3">
             {/* If we had sales, we'd render them here. For now just standard fallback. */}
             <p className="text-sm text-muted-foreground text-center py-8">Sales list shown on desktop or when populated.</p>
          </div>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block">
        <AdminDataTable
          rows={sales ?? []}
          columns={columns}
          isLoading={isPending}
          getRowKey={(row) => row.id}
          onRowClick={(row) => setActive(row)}
          getRowLabel={(row) => `Open sale for ${row.buyerName}`}
          searchPlaceholder="Search by buyer or artwork"
          searchValue={(row) =>
            `${row.buyerName} ${row.buyerEmail} ${getArtworkById(row.artworkId)?.title ?? ""}`
          }
          filters={[
            {
              key: "shipmentStatus",
              label: "Shipment",
              options: SHIPMENT_STATUSES.map((s) => ({
                value: s,
                label: SHIPMENT_LABEL[s],
              })),
              matches: (row, value) => row.shipmentStatus === value,
            },
          ]}
          emptyTitle="No sales yet"
          emptyDescription="Recorded sales from your holdings will show up here."
          emptyIcon={ShoppingBag}
        />
      </div>

      <SaleDetailDialog sale={active} onClose={() => setActive(null)} />
    </>
  );
}

function SaleDetailDialog({
  sale,
  onClose,
}: {
  sale: AggregatorSale | null;
  onClose: () => void;
}) {
  const artwork = sale ? getArtworkById(sale.artworkId) : undefined;

  return (
    <Dialog open={Boolean(sale)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {sale && (
          <>
            <DialogHeader>
              <DialogTitle>{artwork?.title ?? sale.artworkId}</DialogTitle>
              <DialogDescription>
                Sold to {sale.buyerName} for {formatINR(sale.soldPrice)}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-4">
              <Detail label="Buyer email" value={sale.buyerEmail} />
              <Detail label="Buyer phone" value={sale.buyerPhone} />
              <Detail
                label="Delivery mode"
                value={sale.deliveryMode === "courier" ? "Courier" : "Self pickup"}
              />
              <Detail
                label="Commission"
                value={formatINR(commissionForSale(sale))}
              />
              <div className="col-span-2 min-w-0">
                <dt className="text-xs text-muted-foreground">Delivery address</dt>
                <dd className="text-sm text-foreground">
                  {sale.deliveryAddress.line1}, {sale.deliveryAddress.city},{" "}
                  {sale.deliveryAddress.state} {sale.deliveryAddress.pincode}
                </dd>
              </div>
              {sale.courierRef && (
                <Detail label="Courier reference" value={sale.courierRef} />
              )}
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm text-foreground">{value}</dd>
    </div>
  );
}
