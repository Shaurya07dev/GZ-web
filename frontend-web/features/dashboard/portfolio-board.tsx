"use client";

import { useMemo } from "react";
import Image from "next/image";
import { RarityBadge } from "@/components/shared/rarity-badge";
import { motion } from "framer-motion";
import type { ArtworkStatus } from "@/types/artwork";
import { useArtistDashboardArtworks } from "@/hooks/useArtistArtworks";

// What buyers effectively see of this artist's work, distinct from My
// Artworks' management board (which also shows drafts/pending). Read-only —
// no edit affordances. Devika Rao has no public artist profile page (she's
// deliberately excluded from lib/mock-data/artists.ts's mockArtists), so
// this is an in-dashboard preview only, not a link-out to a live page.
const PUBLIC_STATUSES = new Set<ArtworkStatus>([
  "marketplace",
  "with_aggregator",
  "sold",
  "settlement_complete",
]);

export function PortfolioBoard() {
  const { data: artworks } = useArtistDashboardArtworks();

  const visible = useMemo(
    () => (artworks ?? []).filter((a) => PUBLIC_STATUSES.has(a.status)),
    [artworks],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          {visible.length} pieces visible to buyers
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          A preview of how your published work looks across GalleryZone.
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing published yet — approved artworks will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((artwork, i) => (
            <motion.div
              key={artwork.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04, ease: "easeOut" }}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={artwork.thumbnailUrl}
                  alt={artwork.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="object-cover"
                />
                <div className="absolute top-3 right-3">
                  <RarityBadge rarity={artwork.rarityType} />
                </div>
              </div>
              <div className="p-4">
                <h3 className="truncate font-display text-base font-semibold text-foreground">
                  {artwork.title}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {artwork.medium}
                  {artwork.yearCreated ? ` · ${artwork.yearCreated}` : ""}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
