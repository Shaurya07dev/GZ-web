import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { ArtworkAdminDetail } from "@/features/admin/catalog/artwork-admin-detail";
import { mockArtworks } from "@/lib/mock-data/artworks";
import { mockPendingArtworks } from "@/lib/mock-data/admin";

export default async function AdminArtworkDetailPage(
  props: PageProps<"/admin/artworks/[artworkId]">,
) {
  const { artworkId } = await props.params;
  const artwork =
    mockArtworks.find((a) => a.id === artworkId) ??
    mockPendingArtworks.find((a) => a.id === artworkId);

  if (!artwork) notFound();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={artwork.title}
        description="Full record, provenance, and admin controls."
        backHref="/admin/artworks"
        backLabel="Back to artworks"
      />
      <ArtworkAdminDetail artwork={artwork} />
    </div>
  );
}
