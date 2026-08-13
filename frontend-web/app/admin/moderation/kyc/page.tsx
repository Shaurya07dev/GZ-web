import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { KycQueueTable } from "@/features/admin/moderation/kyc-queue-table";

export const metadata = {
  title: "KYC queue — GalleryZone Admin",
};

export default function AdminKycQueuePage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="KYC queue"
        description="Identity checks waiting on verification. Artists cannot be paid out until this clears."
      />
      <KycQueueTable />
    </div>
  );
}
