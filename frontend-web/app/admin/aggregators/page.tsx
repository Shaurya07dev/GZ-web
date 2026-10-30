import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { UserTable } from "@/features/admin/people/user-table";
import { DownloadExcelButton } from "@/components/shared/download-excel-button";

export const metadata = {
  title: "Aggregators | GalleryZone Admin",
};

export default function AdminAggregatorsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          title="Aggregators"
          description="Galleries and distributors holding work on consignment."
        />
        <DownloadExcelButton endpoint="users.xlsx?role=aggregator" />
      </div>
      <UserTable role="aggregator" />
    </div>
  );
}
