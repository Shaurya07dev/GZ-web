import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { WithdrawalQueueTable } from "@/features/admin/moderation/withdrawal-queue-table";

export const metadata = {
  title: "Payouts | GalleryZone Admin",
};

export default function AdminPayoutsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Payouts"
        description="Money owed to artists and aggregators from the GalleryZone escrow. Transfer each payout from the admin bank account and mark it paid with the Razorpay / NEFT reference number."
      />
      <WithdrawalQueueTable />
    </div>
  );
}
