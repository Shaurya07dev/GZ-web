import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { ArtworkAdminTable } from "@/features/admin/catalog/artwork-admin-table";

export const metadata = {
  title: "Artworks — GalleryZone Admin",
};

export default function AdminArtworksPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Artworks"
        description="Every work on the platform, at every stage of its life."
      />
      <ArtworkAdminTable />
    </div>
  );
}
