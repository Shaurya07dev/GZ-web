"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useWishlistStore } from "@/store/useWishlistStore";
import { getArtworkById, toSummary } from "@/lib/mock-data/helpers";
import { ArtworkCard } from "@/components/shared/artwork-card";
import { EmptyState } from "@/components/shared/empty-state";

// Client component: this page revolves entirely around
// useWishlistStore's localStorage-backed ids, so there's nothing to
// render server-side (a fresh server request always sees an empty
// wishlist -- see this page's Task 4 verification notes). Same grid
// treatment as the Marketplace page (features/marketplace/marketplace-grid.tsx).
export default function AccountWishlistPage() {
  const ids = useWishlistStore((state) => state.ids);

  const artworks = ids
    .map((id) => getArtworkById(id))
    .filter((artwork) => artwork !== undefined)
    .map(toSummary);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Your wishlist
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Artworks you&rsquo;ve saved for later, all in one place.
        </p>
      </div>

      {artworks.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          description="Browse the marketplace and tap the heart on anything you like to save it here."
          action={
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 rounded-md border border-gold/60 px-4 py-2 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
            >
              Browse the marketplace
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {artworks.map((artwork) => (
            <ArtworkCard key={artwork.id} artwork={artwork} />
          ))}
        </div>
      )}
    </div>
  );
}
