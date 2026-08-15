"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { ArtworkAdminDetail } from "@/features/admin/catalog/artwork-admin-detail";
import { useAdminArtwork } from "@/hooks/useAdminCatalog";

export default function AdminArtworkDetailPage(
  props: PageProps<"/admin/artworks/[artworkId]">,
) {
  const { artworkId } = use(props.params);
  const { data: artwork, isLoading } = useAdminArtwork(artworkId);

  if (isLoading) return null;
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
