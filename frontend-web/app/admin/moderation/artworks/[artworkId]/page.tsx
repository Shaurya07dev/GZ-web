"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { ArtworkReviewPanel } from "@/features/admin/moderation/artwork-review-panel";
import { useAdminPendingArtwork } from "@/hooks/useAdminModeration";

export default function AdminArtworkReviewPage(
  props: PageProps<"/admin/moderation/artworks/[artworkId]">,
) {
  const { artworkId } = use(props.params);
  const { data: artwork, isLoading } = useAdminPendingArtwork(artworkId);

  if (isLoading) return null;
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
