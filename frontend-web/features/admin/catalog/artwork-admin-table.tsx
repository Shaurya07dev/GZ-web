"use client";

import Image from "next/image";
import { Palette } from "lucide-react";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import {
  AdminStatusBadge,
  adminStatusLabel,
} from "@/features/admin/admin-status-badge";
import { useAdminArtworks } from "@/hooks/useAdminCatalog";
import { formatINR } from "@/lib/utils";
import {
  ARTWORK_RARITY_OPTIONS,
  LISTING_TYPE_LABEL,
  type Artwork,
} from "@/types/artwork";
import { RarityBadge } from "@/components/shared/rarity-badge";

export function ArtworkAdminTable() {
  const { data: artworks, isPending } = useAdminArtworks();
  const rows = artworks ?? [];

  const statuses = Array.from(new Set(rows.map((a) => a.status))).sort();
  const categories = Array.from(new Set(rows.map((a) => a.category))).sort();

  const columns: AdminDataTableColumn<Artwork>[] = [
    {
      key: "artwork",
      header: "Artwork",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            {row.images[0] ? (
              <Image
                src={row.images[0].thumbnailUrl}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {row.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.artistName}
            </p>
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.title,
    },
    {
      key: "category",
      header: "Category",
      render: (row) => (
        <span className="text-sm capitalize text-muted-foreground">
          {row.category}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.category,
    },
    {
      key: "rarity",
      header: "Rank",
      render: (row) =>
        row.rarityType ? (
          <RarityBadge rarity={row.rarityType} />
        ) : (
          <span className="text-xs text-muted-foreground">Unranked</span>
        ),
      sortable: true,
      // Unranked sorts last rather than first: the useful question is "what has
      // GalleryZone ranked", and blanks at the top bury the answer.
      sortValue: (row) => row.rarityType ?? "ZZ",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <AdminStatusBadge status={row.status} size="sm" />,
      sortable: true,
      sortValue: (row) => row.status,
    },
    {
      key: "price",
      header: "Price",
      render: (row) => (
        <span className="text-sm tabular-nums text-foreground">
          {formatINR(row.customerPrice)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.customerPrice,
    },
    {
      key: "listing",
      header: "Channel",
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {LISTING_TYPE_LABEL[row.listingType]}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.listingType,
    },
  ];

  return (
    <AdminDataTable
      rows={rows}
      columns={columns}
      isLoading={isPending}
      getRowKey={(row) => row.id}
      getRowHref={(row) => `/admin/artworks/${row.id}`}
      getRowLabel={(row) => `Open ${row.title}`}
      searchPlaceholder="Search by title, artist, or medium"
      searchValue={(row) => `${row.title} ${row.artistName} ${row.medium}`}
      filters={[
        {
          key: "status",
          label: "Status",
          options: statuses.map((s) => ({
            value: s,
            label: adminStatusLabel(s),
          })),
          matches: (row, value) => row.status === value,
        },
        {
          key: "category",
          label: "Category",
          options: categories.map((c) => ({ value: c, label: c })),
          matches: (row, value) => row.category === value,
        },
        {
          key: "rarity",
          label: "Rank",
          options: [
            ...ARTWORK_RARITY_OPTIONS.map((o) => ({
              value: o.value,
              label: `${o.value} — ${o.label}`,
            })),
            { value: "none", label: "Unranked" },
          ],
          matches: (row, value) =>
            value === "none" ? !row.rarityType : row.rarityType === value,
        },
      ]}
      emptyTitle="No artworks"
      emptyDescription="Nothing matches the current filters."
      emptyIcon={Palette}
    />
  );
}
