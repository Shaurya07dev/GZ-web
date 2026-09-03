"use client";

import { useState } from "react";
import "@/lib/motion-config";
import { motion } from "framer-motion";
import { LayoutGrid, List, SearchX, TriangleAlert } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArtworkCard, ArtworkListRow } from "@/components/shared/artwork-card";
import { ArtworkCardSkeleton } from "@/components/shared/artwork-card-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { useArtworks } from "@/hooks/useArtworks";
import type { ArtworkFilters } from "@/types/artwork";

const GRID_CLASS =
  "grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6";

const SORT_OPTIONS: {
  value: NonNullable<ArtworkFilters["sortBy"]>;
  label: string;
}[] = [
  { value: "newest", label: "Newest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

interface MarketplaceGridProps {
  filters: ArtworkFilters;
  onChange: (filters: ArtworkFilters) => void;
  onClearFilters: () => void;
}

export function MarketplaceGrid({
  filters,
  onChange,
  onClearFilters,
}: MarketplaceGridProps) {
  const { data: artworks, isPending, isError } = useArtworks(filters);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  if (isPending) {
    return (
      <div
        className={GRID_CLASS}
        aria-busy="true"
        aria-label="Loading artworks"
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <ArtworkCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (isError || !artworks) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description="We couldn't load the marketplace right now. Please try again in a moment."
      />
    );
  }

  if (artworks.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No artworks match your filters"
        description="Try widening your price range or clearing a filter to see more original work."
        action={
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center rounded-md border border-gold/50 px-4 py-2 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
          >
            Clear filters
          </button>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          {artworks.length} {artworks.length === 1 ? "artwork" : "artworks"}{" "}
          found
        </p>
        <div className="flex items-center gap-2.5">
          <Select
            value={filters.sortBy ?? "newest"}
            onValueChange={(value) =>
              onChange({
                ...filters,
                sortBy: (value as ArtworkFilters["sortBy"]) ?? "newest",
              })
            }
          >
            <SelectTrigger className="h-9 w-[184px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={cn(
                "flex size-8 items-center justify-center rounded transition-colors",
                viewMode === "grid"
                  ? "bg-gold-deep text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              className={cn(
                "flex size-8 items-center justify-center rounded transition-colors",
                viewMode === "list"
                  ? "bg-gold-deep text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <div className={viewMode === "grid" ? GRID_CLASS : "flex flex-col gap-3"}>
        {artworks.map((artwork, index) => (
          <motion.div
            key={artwork.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              ease: "easeOut",
              delay: Math.min(index, 10) * 0.03,
            }}
          >
            {viewMode === "grid" ? (
              <ArtworkCard artwork={artwork} />
            ) : (
              <ArtworkListRow artwork={artwork} />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
