"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Plus, Pencil, Lock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ArtworkStatusPill } from "./artwork-status-pill";

const FILTERS: { value: ArtworkStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending" },
  { value: "marketplace", label: "Live" },
  { value: "with_aggregator", label: "With aggregator" },
  { value: "sold", label: "Sold" },
  { value: "sold_externally", label: "Sold elsewhere" },
];

type ArtistArtwork = Artwork & { artistPrice: number };

export function ArtworksBoard() {
  const { data: artworks } = useArtistDashboardArtworks();
  const [filter, setFilter] = useState<ArtworkStatus | "all">("all");
  const [soldElsewhereTarget, setSoldElsewhereTarget] =
    useState<ArtistArtwork | null>(null);
  const markSoldMutation = useMarkSoldElsewhereMutation();

  const filtered = useMemo(() => {
    const all = artworks ?? [];
    return filter === "all" ? all : all.filter((a) => a.status === filter);
  }, [artworks, filter]);

  const penaltyAmount = soldElsewhereTarget
    ? Math.round(soldElsewhereTarget.customerPrice * EXTERNAL_SALE_PENALTY_RATE)
    : 0;

  function confirmSoldElsewhere() {
    const artwork = soldElsewhereTarget;
    if (!artwork) return;
    markSoldMutation.mutate(artwork.id, {
      onSuccess: () => {
        toast.success(`"${artwork.title}" marked as sold elsewhere.`);
        setSoldElsewhereTarget(null);
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong.",
        );
        setSoldElsewhereTarget(null);
      },
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

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as ArtworkStatus | "all")}
      >
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {FILTERS.map((f) => (
            <TabsTrigger
              key={f.value}
              value={f.value}
              className="rounded-md border border-border px-3.5 py-1.5 text-sm text-muted-foreground data-active:border-gold/50 data-active:bg-gold/10 data-active:text-gold-bright after:hidden"
            >
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No artworks in this status yet.
          </p>
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
        {"rarityType" in artwork && (artwork as { rarityType?: string }).rarityType && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center rounded-sm bg-gold-bright px-1.5 py-0.5 text-[10px] font-bold text-background leading-none">
              {String((artwork as { rarityType: string }).rarityType)}
            </span>
          </div>
        )}
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
