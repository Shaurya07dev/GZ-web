import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { UserTable } from "@/features/admin/people/user-table";
import { DownloadExcelButton } from "@/components/shared/download-excel-button";

export const metadata = {
  title: "Artists | GalleryZone Admin",
};

export default function AdminArtistsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          title="Artists"
          description="Everyone listing work on the platform, and where their verification stands."
        />
        <DownloadExcelButton endpoint="users.xlsx?role=artist" />
      </div>
      <UserTable role="artist" />
    </div>
  );
}
