import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { ExternalFeeQueueTable } from "@/features/admin/moderation/external-fee-queue-table";

export const metadata = {
  title: "Off-platform fees | GalleryZone Admin",
};

export default function AdminExternalFeesPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Off-platform sale fees"
        description="The 1% fee raised when an artist sells a piece elsewhere. Nothing is charged until you approve it — waive it with a reason and the artist is never billed."
      />
      <ExternalFeeQueueTable />
    </div>
  );
}
