import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Palette } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArtworkCard } from "@/components/shared/artwork-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ArtistProfileHeader } from "@/features/artists/artist-profile-header";
import { ArtistStory } from "@/features/artists/artist-story";
import { artistService, artworkService } from "@/services/artworkService";

// react's cache() dedupes the artist lookup between generateMetadata and the
// page component within a single request (same reasoning as
// app/marketplace/[artworkId]/page.tsx).
const getArtist = cache((artistId: string) => artistService.get(artistId));

export async function generateMetadata(
  props: PageProps<"/artists/[artistId]">,
): Promise<Metadata> {
  const { artistId } = await props.params;
  const artist = await getArtist(artistId);

  if (!artist) {
    return { title: "Artist not found | GalleryZone" };
  }

  return {
    title: `${artist.name} | GalleryZone`,
    description: `${artist.name} on GalleryZone: verified original artwork, priced with full artist privacy.`,
  };
}

// Async Server Component, mirroring app/marketplace/[artworkId]/page.tsx's
// approach: a direct server-side service lookup (rather than the
// useArtistProfile/useArtistArtworks client hooks) gives this mostly-static
// public profile a real 404 and full content before any client JS runs —
// the same "Server Component initial SEO" reasoning SAD §5.6 calls for, and
// the same allowance Task 17 makes explicit for the (equally static, public)
// Verify page. Only ArtistStory (the sanitized bio) and each ArtworkCard's
// wishlist button are client components.
export default async function ArtistProfilePage(
  props: PageProps<"/artists/[artistId]">,
) {
  const { artistId } = await props.params;
  const artist = await getArtist(artistId);

  if (!artist) {
    notFound();
  }

  const listings = await artworkService.listByArtist(artistId);

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-12 lg:px-10 lg:py-16">
          <ArtistProfileHeader artist={artist} />

          <div className="mt-10 border-t border-border pt-10">
            <ArtistStory bio={artist.bio} />
          </div>

          <div className="mt-12">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Listed artworks
            </h2>

            {listings.length === 0 ? (
              <EmptyState
                icon={Palette}
                title="No artworks listed yet"
                description={`${artist.name} doesn't have any artwork on the marketplace right now. Check back soon.`}
                className="mt-5"
              />
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
                {listings.map((artwork) => (
                  <ArtworkCard key={artwork.id} artwork={artwork} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
