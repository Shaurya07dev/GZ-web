import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { AdminHoldingReportsBoard } from "@/features/admin/moderation/admin-holding-reports-board";

export const metadata = {
  title: "Holding reports | GalleryZone Admin",
};

export default function AdminHoldingReportsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Holding reports"
        description="Aggregator-raised issues on pieces they're holding (damage, wrong piece, COA/NFC problems). Mark each one resolved with a note for the aggregator."
      />
      <AdminHoldingReportsBoard />
    </div>
  );
}
