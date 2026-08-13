import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { UserTable } from "@/features/admin/people/user-table";

export const metadata = {
  title: "Artists | GalleryZone Admin",
};

export default function AdminArtistsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Artists"
        description="Everyone listing work on the platform, and where their verification stands."
      />
      <UserTable role="artist" />
    </div>
  );
}
