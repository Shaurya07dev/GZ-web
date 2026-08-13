import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArtistCard } from "@/features/artists/artist-card";
import { mockArtists } from "@/lib/mock-data/artists";

export const metadata: Metadata = {
  title: "Artists — GalleryZone",
  description:
    "Meet the independent, verified artists selling original artwork on GalleryZone.",
};

// Simple static grid over the full fixture set — no filters/search in scope
// for this page (Task 16 Step 2), so a plain server component is enough.
export default function ArtistsDirectoryPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <section className="border-b border-border/60 bg-card/30 px-6 py-14 lg:px-10 lg:py-16">
          <div className="mx-auto max-w-[1400px]">
            <h1 className="text-balance font-display text-4xl leading-[1.15] font-semibold sm:text-5xl">
              Our Artists
            </h1>
            <p className="mt-3 max-w-xl text-balance text-base leading-relaxed text-muted-foreground">
              Independent artists building their practice on GalleryZone —
              every listing backed by full price privacy and a signed
              certificate of authenticity.
            </p>
          </div>
        </section>

        <section className="px-6 py-10 lg:px-10">
          <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {mockArtists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
