import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { GstQueueTable } from "@/features/admin/moderation/gst-queue-table";

export const metadata = {
  title: "GST queue | GalleryZone Admin",
};

export default function AdminGstQueuePage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="GST queue"
        description="Artist GST registrations waiting on approval. Artwork cannot go live until this clears."
      />
      <GstQueueTable />
    </div>
  );
}
