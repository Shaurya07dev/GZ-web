"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Plus, Pencil, Lock, ExternalLink } from "lucide-react";
import { ConfirmActionDialog } from "@/features/admin/confirm-action-dialog";
import {
  artworkEditState,
  ARTWORK_EDIT_WINDOW_DAYS,
  EXTERNAL_SALE_PENALTY_RATE,
  LISTING_TYPE_LABEL,
  WITHDRAWABLE_STATUSES,
  type Artwork,
  type ArtworkStatus,
} from "@/types/artwork";
import { formatINR } from "@/lib/utils";
import {
  useArtistDashboardArtworks,
  useMarkSoldElsewhereMutation,
} from "@/hooks/useArtistArtworks";
import { RarityBadge } from "@/components/shared/rarity-badge";
import { ArtworkStatusPill } from "./artwork-status-pill";

// Each tab is a bucket of statuses, not one status: a piece that is
// "reserved" by an aggregator belongs under "With aggregator", and one
// that is "delivered" or "completed" is still a sale. Every status the
// API can return lands in exactly one bucket, so nothing is reachable
// only through "All".
type FilterKey = "all" | "draft" | "pending" | "live" | "aggregator" | "sold" | "sold_externally" | "returned";

const FILTERS: { value: FilterKey; label: string; statuses: readonly ArtworkStatus[] | null }[] = [
  { value: "all", label: "All", statuses: null },
  { value: "draft", label: "Draft", statuses: ["draft"] },
  { value: "pending", label: "Pending", statuses: ["pending_approval"] },
  { value: "live", label: "Live", statuses: ["marketplace"] },
  { value: "aggregator", label: "With aggregator", statuses: ["reserved", "with_aggregator"] },
  { value: "sold", label: "Sold", statuses: ["sold", "settlement_complete", "delivered", "completed"] },
  { value: "sold_externally", label: "Sold elsewhere", statuses: ["sold_externally"] },
  { value: "returned", label: "Returned", statuses: ["returned"] },
];

type ArtistArtwork = Artwork & { artistPrice: number };

export function ArtworksBoard() {
  const { data: artworks } = useArtistDashboardArtworks();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [soldElsewhereTarget, setSoldElsewhereTarget] =
    useState<ArtistArtwork | null>(null);
  const markSoldMutation = useMarkSoldElsewhereMutation();

  const counts = useMemo(() => {
    const all = artworks ?? [];
    return Object.fromEntries(
      FILTERS.map((f) => [f.value, f.statuses ? all.filter((a) => f.statuses!.includes(a.status)).length : all.length]),
    ) as Record<FilterKey, number>;
  }, [artworks]);

  const filtered = useMemo(() => {
    const all = artworks ?? [];
    const bucket = FILTERS.find((f) => f.value === filter)?.statuses;
    return bucket ? all.filter((a) => bucket.includes(a.status)) : all;
  }, [artworks, filter]);

  const penaltyAmount = soldElsewhereTarget
    ? Math.round(soldElsewhereTarget.customerPrice * EXTERNAL_SALE_PENALTY_RATE)
    : 0;

  function confirmSoldElsewhere() {
    const artwork = soldElsewhereTarget;
    if (!artwork) return;
    markSoldMutation.mutate(artwork.id, {
      // The hook shows the success/failure box; here we only close the dialog.
      onSettled: () => setSoldElsewhereTarget(null),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            {(artworks ?? []).length} artworks
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage submissions, track status, and see what&rsquo;s live.
          </p>
        </div>
        <Link
          href="/dashboard/artworks/upload"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-bright/95 px-4 py-2.5 text-sm font-semibold text-[#171310] transition-colors hover:bg-gold-bright"
        >
          <Plus className="size-4" />
          List new artwork
        </Link>
      </div>

      <div role="group" aria-label="Filter artworks by status" className="flex flex-wrap gap-x-1 gap-y-2">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          // Empty buckets stay visible so the artist learns the vocabulary,
          // but only "All" is worth a click when there is nothing in it.
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.value)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3.5 py-1.5 text-sm transition-colors ${
                active
                  ? "border-gold/50 bg-gold/10 text-gold-bright"
                  : "border-border text-muted-foreground hover:border-gold/30 hover:text-foreground"
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                  active ? "bg-gold/20 text-gold-bright" : "bg-secondary text-muted-foreground"
                }`}
              >
                {counts[f.value]}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {filter === "all"
              ? "You haven’t listed anything yet."
              : `Nothing under “${FILTERS.find((f) => f.value === filter)?.label}” right now.`}
          </p>
          {filter !== "all" && (artworks ?? []).length > 0 && (
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="mt-2 text-xs font-medium text-gold-bright hover:underline"
            >
              Show all {(artworks ?? []).length}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((artwork, i) => (
            <ArtworkCard
              key={artwork.id}
              artwork={artwork}
              index={i}
              onSoldElsewhere={() => setSoldElsewhereTarget(artwork)}
            />
          ))}
        </div>
      )}

      <ConfirmActionDialog
        open={soldElsewhereTarget !== null}
        onOpenChange={(open) => {
          if (!open) setSoldElsewhereTarget(null);
        }}
        title="Mark as sold on another platform?"
        description={
          soldElsewhereTarget
            ? `"${soldElsewhereTarget.title}" will be removed from all GalleryZone sales channels immediately and cannot be relisted. A platform fee (up to 1% of its listed price — ${formatINR(penaltyAmount)}) may be applicable at the admin's discretion.`
            : ""
        }
        confirmLabel="Mark as sold elsewhere"
        destructive
        onConfirm={confirmSoldElsewhere}
      />
    </div>
  );
}

function ArtworkCard({
  artwork,
  index,
  onSoldElsewhere,
}: {
  artwork: ArtistArtwork;
  index: number;
  onSoldElsewhere: () => void;
}) {
  const editState = artworkEditState(artwork);
  const canWithdraw = WITHDRAWABLE_STATUSES.has(artwork.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: "easeOut" }}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-gold/30"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={artwork.thumbnailUrl}
          alt={artwork.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3">
          <ArtworkStatusPill status={artwork.status} />
        </div>
        <div className="absolute top-3 right-3">
          <RarityBadge rarity={artwork.rarityType} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate font-display text-base font-semibold text-foreground">
          {artwork.title}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {artwork.medium}
          {artwork.yearCreated ? ` · ${artwork.yearCreated}` : ""}
        </p>

        {/* Both prices, always: the artist's own price and what GalleryZone
            lists the piece at. Transparency is the point, and only the artist
            ever sees this pair. */}
        <dl className="mt-3 flex flex-col gap-1 rounded-md border border-border bg-background/50 px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Your price</dt>
            <dd className="font-mono tabular-nums text-foreground">
              {formatINR(artwork.artistPrice)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Listed price</dt>
            <dd className="font-mono font-medium tabular-nums text-gold-bright">
              {formatINR(artwork.customerPrice)}
            </dd>
          </div>
        </dl>

        <p className="mt-2 text-[11px] text-muted-foreground">
          {LISTING_TYPE_LABEL[artwork.listingType]}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
          {editState.editable ? (
            <Link
              href={`/dashboard/artworks/${artwork.id}/edit`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-bright hover:underline"
            >
              <Pencil className="size-3.5" />
              {artwork.status === "draft"
                ? "Continue editing"
                : `Edit · ${editState.daysLeft} ${editState.daysLeft === 1 ? "day" : "days"} left`}
            </Link>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
              title={
                editState.reason === "purchased"
                  ? "Editing closed because this artwork has been claimed or sold."
                  : `The ${ARTWORK_EDIT_WINDOW_DAYS}-day edit window has closed.`
              }
            >
              <Lock className="size-3.5" />
              {editState.reason === "purchased"
                ? "Locked — sold or claimed"
                : "Edit window closed"}
            </span>
          )}

          {canWithdraw && (
            <button
              type="button"
              onClick={onSoldElsewhere}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-destructive"
            >
              <ExternalLink className="size-3.5" />
              Sold on other platform
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
