import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArtworkPassportView } from "@/features/verify/artwork-passport-view";
import { verifyService } from "@/services/verifyService";

export async function generateMetadata(
  props: PageProps<"/verify/[artworkId]">,
): Promise<Metadata> {
  const { artworkId } = await props.params;
  const artwork = await verifyService.getForMetadata(artworkId);

  if (!artwork) {
    return { title: "Artwork Passport | GalleryZone" };
  }

  return {
    title: `Artwork Passport | ${artwork.title} | GalleryZone`,
    description: `Verify the authenticity and provenance of "${artwork.title}" on GalleryZone.`,
  };
}

// Public, unauthenticated page a physical NFC/QR tag resolves to (backed by
// GET /v1/verify/:artworkId). Metadata is fetched server-side; the body is
// a client component so the owner/chain re-fetch as transfers happen.
export default async function ArtworkPassportPage(
  props: PageProps<"/verify/[artworkId]">,
) {
  const { artworkId } = await props.params;

  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,_rgba(201,154,74,0.12),_transparent_65%)]"
          aria-hidden="true"
        />
        <div className="relative z-10">
          <ArtworkPassportView artworkId={artworkId} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
