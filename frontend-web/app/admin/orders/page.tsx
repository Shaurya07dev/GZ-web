import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { OrderAdminTable } from "@/features/admin/commerce/order-admin-table";

export const metadata = {
  title: "Orders — GalleryZone Admin",
};

export default function AdminOrdersPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Orders"
        description="Every purchase through the marketplace, at every fulfilment stage."
      />
      <OrderAdminTable />
    </div>
  );
}
