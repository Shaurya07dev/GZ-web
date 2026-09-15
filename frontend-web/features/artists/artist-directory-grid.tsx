"use client";

import { Users } from "lucide-react";
import { ArtistCard } from "@/features/artists/artist-card";
import { EmptyState } from "@/components/shared/empty-state";
import { useArtistDirectory } from "@/hooks/usePublic";

export function ArtistDirectoryGrid() {
  const { data: artists, isPending, isError } = useArtistDirectory();

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5" aria-busy="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
    );
  }
  if (isError) {
    return <EmptyState icon={Users} title="Couldn't load artists" description="Please try again in a moment." />;
  }
  if (!artists.length) {
    return <EmptyState icon={Users} title="No artists listed yet" description="Artists appear here as soon as their first piece is approved for the marketplace." />;
  }
  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
      {artists.map((artist) => (
        <ArtistCard key={artist.id} artist={artist} />
      ))}
    </div>
  );
}
