"use client";

import { useState, useMemo } from "react";
import "@/lib/motion-config";
import { motion } from "framer-motion";
import { LayoutGrid, List, SearchX, TriangleAlert, X, Filter } from "lucide-react";
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

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

const GRID_CLASS =
  "grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6";

const GRID_CLASS_COMPACT =
  "grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4 lg:gap-6";

const SORT_OPTIONS: {
  value: NonNullable<ArtworkFilters["sortBy"]>;
  label: string;
}[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

interface MarketplaceGridProps {
  filters: ArtworkFilters;
  onChange: (filters: ArtworkFilters) => void;
  onClearFilters: () => void;
  showFilters?: boolean;
  onToggleFilters?: () => void;
}

export function MarketplaceGrid({
  filters,
  onChange,
  onClearFilters,
  showFilters,
  onToggleFilters,
}: MarketplaceGridProps) {
  const { data: artworks, isPending, isError } = useArtworks(filters);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.category) {
      chips.push({ key: "category", label: titleCase(filters.category), onRemove: () => onChange({ ...filters, category: undefined }) });
    }
    if (filters.medium) {
      chips.push({ key: "medium", label: titleCase(filters.medium), onRemove: () => onChange({ ...filters, medium: undefined }) });
    }
    if (filters.size) {
      chips.push({ key: "size", label: titleCase(filters.size), onRemove: () => onChange({ ...filters, size: undefined }) });
    }
    if (filters.rarity) {
      chips.push({ key: "rarity", label: `Rank: ${filters.rarity}`, onRemove: () => onChange({ ...filters, rarity: undefined }) });
    }
    if (filters.availability) {
      chips.push({ key: "availability", label: filters.availability === "available" ? "Available now" : "Reserved / sold", onRemove: () => onChange({ ...filters, availability: undefined }) });
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const min = filters.minPrice ?? 0;
      const max = filters.maxPrice ?? 200000;
      chips.push({ key: "price", label: `₹${Math.floor(min/1000)}k - ₹${Math.floor(max/1000)}k`, onRemove: () => onChange({ ...filters, minPrice: undefined, maxPrice: undefined }) });
    }
    return chips;
  }, [filters, onChange]);

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
      {activeChips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              {chip.label}
              <X className="size-3 text-muted-foreground" />
            </button>
          ))}
          <button
            onClick={onClearFilters}
            className="ml-1 text-xs font-medium text-gold-bright hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-card/30 p-2 sm:px-4">
        <div className="flex items-center gap-3">
          {onToggleFilters && (
            <button
              onClick={onToggleFilters}
              className="flex items-center gap-2 rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:border-r sm:border-border sm:pr-3"
            >
              <Filter className="size-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">{showFilters ? "Hide Filters" : "Show Filters"}</span>
              <span className="sm:hidden">Filters</span>
            </button>
          )}
          <p className="text-sm text-muted-foreground px-2 sm:px-0" role="status">
            <strong className="font-semibold text-foreground">{artworks.length}</strong> {artworks.length === 1 ? "artwork" : "artworks"} found
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.sortBy ?? "newest"}
            onValueChange={(value) =>
              onChange({
                ...filters,
                sortBy: (value as ArtworkFilters["sortBy"]) ?? "newest",
              })
            }
          >
            <SelectTrigger className="h-9 w-auto min-w-[140px] gap-2 border-0 bg-transparent px-3 font-medium shadow-none hover:bg-muted focus:ring-0">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground font-normal hidden sm:inline">Sort:</span>
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-md border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={cn(
                "flex size-8 items-center justify-center rounded transition-colors",
                viewMode === "grid"
                  ? "bg-muted text-foreground font-medium"
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
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <div className={viewMode === "grid" ? (showFilters ? GRID_CLASS : GRID_CLASS_COMPACT) : "flex flex-col gap-3"}>
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
