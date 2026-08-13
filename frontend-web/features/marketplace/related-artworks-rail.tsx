import { ArtworkCard } from "@/components/shared/artwork-card";
import type { ArtworkSummary } from "@/types/artwork";

interface RelatedArtworksRailProps {
  artworks: ArtworkSummary[];
  artistName: string;
}

// Horizontal rail of up to 4 other listings from the same artist (the
// caller is responsible for excluding the current artwork and slicing to
// 4 — see app/marketplace/[artworkId]/page.tsx). Renders nothing if the
// artist has no other listed work, per Task 15 Step 3.
export function RelatedArtworksRail({ artworks, artistName }: RelatedArtworksRailProps) {
  if (artworks.length === 0) return null;

  return (
    <section className="mt-16 border-t border-border pt-10">
      <h2 className="font-display text-xl font-semibold text-foreground">
        More from {artistName}
      </h2>
      <div className="mt-5 flex gap-4 overflow-x-auto pb-2 sm:gap-5">
        {artworks.map((artwork) => (
          <ArtworkCard
            key={artwork.id}
            artwork={artwork}
            className="w-[68vw] max-w-[220px] shrink-0 sm:w-[220px]"
          />
        ))}
      </div>
    </section>
  );
}
