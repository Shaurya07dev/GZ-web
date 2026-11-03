import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { SettlementTable } from "@/features/admin/commerce/settlement-table";
import { DownloadExcelButton } from "@/components/shared/download-excel-button";

export const metadata = {
  title: "Settlements | GalleryZone Admin",
};

export default function AdminSettlementsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          title="Settlements"
          description="How each sale was split between artist, aggregator, and platform."
        />
        <DownloadExcelButton endpoint="settlements.xlsx" />
      </div>
      <SettlementTable />
    </div>
  );
}
