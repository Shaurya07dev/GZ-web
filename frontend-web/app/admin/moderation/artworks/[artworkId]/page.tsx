import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { ArtworkReviewPanel } from "@/features/admin/moderation/artwork-review-panel";
import { mockPendingArtworks } from "@/lib/mock-data/admin";

export default async function AdminArtworkReviewPage(
  props: PageProps<"/admin/moderation/artworks/[artworkId]">,
) {
  const { artworkId } = await props.params;
  const artwork = mockPendingArtworks.find((a) => a.id === artworkId);

  if (!artwork) notFound();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Review submission"
        description="Judge the work, then clear the eligibility criteria to approve it."
        backHref="/admin/moderation/artworks"
        backLabel="Back to queue"
      />
      <ArtworkReviewPanel artwork={artwork} />
    </div>
  );
}
