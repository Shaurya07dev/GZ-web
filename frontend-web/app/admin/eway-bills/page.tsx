import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { EwayBillsTable } from "@/features/admin/commerce/eway-bills-table";

export const metadata = {
  title: "E-Way Bills | GalleryZone Admin",
};

export default function AdminEwayBillsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="E-Way Bills"
        description="Every NIC e-way bill attempt — success and failure. Cancel a bill within 24h of generation, or extend its validity if a parcel is stuck in transit."
      />
      <EwayBillsTable />
    </div>
  );
}
