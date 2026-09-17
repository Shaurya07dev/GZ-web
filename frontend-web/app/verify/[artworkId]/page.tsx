import type { Metadata } from "next";
import { NfcArtworkPassportView } from "@/features/verify/nfc-artwork-passport-view";
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
    // Optimise for the mobile card share preview when someone screenshots and
    // shares the verification page after tapping the physical NFC tag.
    openGraph: {
      title: `${artwork.title} — Authenticated by GalleryZone`,
      description: `One tag. One artwork. One unbroken record.`,
      images: artwork.images[0]
        ? [{ url: artwork.images[0].url, width: 1200, height: 630 }]
        : undefined,
    },
  };
}

// Public, unauthenticated page that an NFC/QR tag resolves to.
// Rendered as a full-bleed mobile-first experience — no site chrome —
// because 95 %+ of visitors arrive via a phone tap, not a desktop browser.
export default async function ArtworkPassportPage(
  props: PageProps<"/verify/[artworkId]">,
) {
  const { artworkId } = await props.params;

  return (
    <main className="relative min-h-dvh">
      <NfcArtworkPassportView artworkId={artworkId} />
    </main>
  );
}
