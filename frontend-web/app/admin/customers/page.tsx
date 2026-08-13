import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { UserTable } from "@/features/admin/people/user-table";

export const metadata = {
  title: "Customers — GalleryZone Admin",
};

export default function AdminCustomersPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Customers"
        description="Collectors buying through the marketplace."
      />
      <UserTable role="customer" />
    </div>
  );
}
