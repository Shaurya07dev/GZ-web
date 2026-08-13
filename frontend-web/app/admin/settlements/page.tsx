import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { SettlementTable } from "@/features/admin/commerce/settlement-table";

export const metadata = {
  title: "Settlements | GalleryZone Admin",
};

export default function AdminSettlementsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Settlements"
        description="How each sale was split between artist, aggregator, and platform."
      />
      <SettlementTable />
    </div>
  );
}
