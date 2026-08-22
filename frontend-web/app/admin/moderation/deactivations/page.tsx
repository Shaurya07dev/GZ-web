import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { DeactivationQueueTable } from "@/features/admin/moderation/deactivation-queue-table";

export const metadata = {
  title: "Deactivations | GalleryZone Admin",
};

export default function AdminDeactivationsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Account deactivations"
        description="Artists asking to close their account. Approving suspends it; refusing sends them a reason and lets them ask again."
      />
      <DeactivationQueueTable />
    </div>
  );
}
