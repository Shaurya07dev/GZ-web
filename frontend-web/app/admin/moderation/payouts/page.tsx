import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { PayoutQueueTable } from "@/features/admin/moderation/payout-queue-table";

export const metadata = {
  title: "Payout queue | GalleryZone Admin",
};

export default function AdminPayoutQueuePage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Payout queue"
        description="Bank-account + IFSC pairs waiting on verification. Settlements can only release funds to an approved payout destination."
      />
      <PayoutQueueTable />
    </div>
  );
}
