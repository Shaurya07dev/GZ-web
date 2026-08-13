"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import { useAdminPendingArtworks } from "@/hooks/useAdminModeration";
import { ADMIN_TODAY } from "@/features/admin/admin-data";
import type { Artwork } from "@/types/artwork";

function waitingDays(artwork: Artwork): number {
  const submitted =
    artwork.statusHistory.at(-1)?.changedAt ?? artwork.coaIssueDate;
  const diff = ADMIN_TODAY.getTime() - new Date(submitted).getTime();
  return Math.max(0, Math.round(diff / 86_400_000));
}

export function ArtworkQueueTable() {
  const { data: artworks, isPending } = useAdminPendingArtworks();

  const columns: AdminDataTableColumn<Artwork>[] = [
    {
      key: "artwork",
      header: "Artwork",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="relative size-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            {row.images[0] ? (
              <Image
                src={row.images[0].thumbnailUrl}
                alt=""
                fill
                sizes="44px"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {row.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.medium} · {row.dimensions ?? "Dimensions not given"}
            </p>
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.title,
    },
    {
      key: "artist",
      header: "Artist",
      render: (row) => (
        <span className="text-sm text-foreground">{row.artistName}</span>
      ),
      sortable: true,
      sortValue: (row) => row.artistName,
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
      key: "listing",
      header: "Listing",
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.listingType === "marketplace_and_aggregator"
            ? "Marketplace + aggregator"
            : "Marketplace only"}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.listingType,
    },
    {
      key: "waiting",
      header: "Waiting",
      render: (row) => {
        const days = waitingDays(row);
        return (
          <span
            className={`text-sm tabular-nums ${days >= 7 ? "font-medium text-gold-bright" : "text-muted-foreground"}`}
          >
            {days === 0 ? "Today" : `${days}d`}
          </span>
        );
      },
      sortable: true,
      sortValue: (row) => waitingDays(row),
      className: "text-right",
    },
  ];

  const categories = Array.from(
    new Set((artworks ?? []).map((a) => a.category)),
  ).sort();

  return (
    <AdminDataTable
      rows={artworks ?? []}
      columns={columns}
      isLoading={isPending}
      getRowKey={(row) => row.id}
      getRowHref={(row) => `/admin/moderation/artworks/${row.id}`}
      getRowLabel={(row) => `Review ${row.title}`}
      searchPlaceholder="Search by title or artist"
      searchValue={(row) => `${row.title} ${row.artistName} ${row.medium}`}
      filters={[
        {
          key: "category",
          label: "Category",
          options: categories.map((c) => ({ value: c, label: c })),
          matches: (row, value) => row.category === value,
        },
      ]}
      emptyTitle="Queue is clear"
      emptyDescription="No artwork is waiting for review right now."
      emptyIcon={ImageIcon}
    />
  );
}
