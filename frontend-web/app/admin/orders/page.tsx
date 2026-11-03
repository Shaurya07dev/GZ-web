import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { OrderAdminTable } from "@/features/admin/commerce/order-admin-table";
import { DownloadExcelButton } from "@/components/shared/download-excel-button";

export const metadata = {
  title: "Orders | GalleryZone Admin",
};

export default function AdminOrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          title="Orders"
          description="Every purchase through the marketplace, at every fulfilment stage."
        />
        <DownloadExcelButton endpoint="orders.xlsx" />
      </div>
      <OrderAdminTable />
    </div>
  );
}
