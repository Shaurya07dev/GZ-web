import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { WithdrawalQueueTable } from "@/features/admin/moderation/withdrawal-queue-table";

export const metadata = {
  title: "Withdrawals | GalleryZone Admin",
};

export default function AdminWithdrawalsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Withdrawals"
        description="Payout requests from artist and aggregator wallets."
      />
      <WithdrawalQueueTable />
    </div>
  );
}
