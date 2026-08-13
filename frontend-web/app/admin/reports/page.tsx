import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { ReportGenerator } from "@/features/admin/system/report-generator";

export const metadata = {
  title: "Reports — GalleryZone Admin",
};

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reports"
        description="Export sales, settlement, payout, and tax figures for a date range."
      />
      <ReportGenerator />
    </div>
  );
}
