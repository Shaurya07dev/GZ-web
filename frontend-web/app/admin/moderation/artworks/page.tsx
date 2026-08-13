import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { ArtworkQueueTable } from "@/features/admin/moderation/artwork-queue-table";

export const metadata = {
  title: "Artwork queue — GalleryZone Admin",
};

export default function AdminArtworkQueuePage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Artwork queue"
        description="Submissions waiting on a curator decision. Oldest first is usually the fair order."
      />
      <ArtworkQueueTable />
    </div>
  );
}
