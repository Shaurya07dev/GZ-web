import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArtworkPassportCard } from "@/features/verify/artwork-passport-card";
import { ProvenanceTimeline } from "@/features/verify/provenance-timeline";
import { getArtistById, getArtworkById } from "@/lib/mock-data/helpers";

export async function generateMetadata(
  props: PageProps<"/verify/[artworkId]">
): Promise<Metadata> {
  const { artworkId } = await props.params;
  const artwork = getArtworkById(artworkId);

  if (!artwork) {
    return { title: "Passport not found — GalleryZone" };
  }

  return {
    title: `Artwork Passport — ${artwork.title} — GalleryZone`,
    description: `Verify the authenticity and provenance of "${artwork.title}" on GalleryZone.`,
  };
}

// Public, unauthenticated page a physical NFC/QR tag resolves to (mirrors
// GET /nfc/{artwork_id}, per the spec) — a plain server-side lookup via the
// Task 2 helpers is deliberately used instead of a query hook, since there
// is no client interactivity here at all, matching Task 17 Step 3's
// explicit guidance.
export default async function ArtworkPassportPage(
  props: PageProps<"/verify/[artworkId]">
) {
  const { artworkId } = await props.params;
  const artwork = getArtworkById(artworkId);

  if (!artwork) {
    notFound();
  }

  const artist = getArtistById(artwork.artistId);
  const coverImage =
    [...artwork.images].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url ??
    artwork.thumbnailUrl;

  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,_rgba(201,154,74,0.12),_transparent_65%)]"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto w-full max-w-2xl px-6 py-14 lg:py-20">
          <Link
            href={`/marketplace/${artwork.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-gold-bright"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Back to listing
          </Link>

          <div className="mt-8">
            <ArtworkPassportCard
              title={artwork.title}
              artistName={artwork.artistName}
              coverImageUrl={coverImage}
              coaCertificateNumber={artwork.coaCertificateNumber}
              coaIssueDate={artwork.coaIssueDate}
            />
          </div>

          <div className="mx-auto mt-14 max-w-md">
            <ProvenanceTimeline history={artwork.statusHistory} />
          </div>

          {artist && (
            <p className="mx-auto mt-14 max-w-md text-center text-xs leading-relaxed text-muted-foreground">
              Registered to{" "}
              <Link
                href={`/artists/${artist.id}`}
                className="font-medium text-gold-bright hover:underline"
              >
                {artist.name}
              </Link>
              , a verified GalleryZone artist.
            </p>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
