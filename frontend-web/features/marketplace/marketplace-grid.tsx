"use client";

import "@/lib/motion-config";
import { motion } from "framer-motion";
import { SearchX, TriangleAlert } from "lucide-react";
import { ArtworkCard } from "@/components/shared/artwork-card";
import { ArtworkCardSkeleton } from "@/components/shared/artwork-card-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useArtworks } from "@/hooks/useArtworks";
import type { ArtworkFilters } from "@/types/artwork";

const GRID_CLASS =
  "grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4";

interface MarketplaceGridProps {
  filters: ArtworkFilters;
  onClearFilters: () => void;
}

export function MarketplaceGrid({
  filters,
  onClearFilters,
}: MarketplaceGridProps) {
  const { data: artworks, isPending, isError } = useArtworks(filters);

  if (isPending) {
    return (
      <div
        className={GRID_CLASS}
        aria-busy="true"
        aria-label="Loading artworks"
      >
        {Array.from({ length: 8 }).map((_, index) => (
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
      <p className="mb-4 text-sm text-muted-foreground" role="status">
        {artworks.length} {artworks.length === 1 ? "artwork" : "artworks"}
      </p>
      <div className={GRID_CLASS}>
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
            <ArtworkCard artwork={artwork} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
