import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { UserTable } from "@/features/admin/people/user-table";
import { DownloadExcelButton } from "@/components/shared/download-excel-button";

export const metadata = {
  title: "Customers | GalleryZone Admin",
};

export default function AdminCustomersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          title="Customers"
          description="Collectors buying through the marketplace."
        />
        <DownloadExcelButton endpoint="users.xlsx?role=customer" />
      </div>
      <UserTable role="customer" />
    </div>
  );
}
