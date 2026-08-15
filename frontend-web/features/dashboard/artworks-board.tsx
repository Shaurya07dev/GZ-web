"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Plus, MoreVertical, Pencil } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ArtworkStatus } from "@/types/artwork";
import { useArtistDashboardArtworks } from "@/hooks/useArtistArtworks";
import { ArtworkStatusPill } from "./artwork-status-pill";

const FILTERS: { value: ArtworkStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending" },
  { value: "marketplace", label: "Live" },
  { value: "with_aggregator", label: "With gallery" },
  { value: "sold", label: "Sold" },
];

export function ArtworksBoard() {
  const { data: artworks } = useArtistDashboardArtworks();
  const [filter, setFilter] = useState<ArtworkStatus | "all">("all");

  const filtered = useMemo(() => {
    const all = artworks ?? [];
    return filter === "all" ? all : all.filter((a) => a.status === filter);
  }, [artworks, filter]);

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
            <motion.div
              key={artwork.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04, ease: "easeOut" }}
              className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-gold/30"
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
                <button
                  type="button"
                  aria-label="More actions"
                  className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm"
                >
                  <MoreVertical className="size-4" />
                </button>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-semibold text-foreground">
                      {artwork.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {artwork.medium}
                      {artwork.yearCreated ? ` · ${artwork.yearCreated}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-sm font-medium tabular-nums text-foreground">
                    ₹{artwork.artistPrice.toLocaleString("en-IN")}
                  </p>
                </div>

                <Link
                  href="/dashboard/artworks/upload"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold-bright hover:underline"
                >
                  <Pencil className="size-3.5" />
                  {artwork.status === "draft"
                    ? "Continue editing"
                    : "View & edit"}
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
