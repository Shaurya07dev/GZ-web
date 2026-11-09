import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { AdminExtensionsBoard } from "@/features/admin/moderation/admin-extensions-board";

export const metadata = {
  title: "Extension requests | GalleryZone Admin",
};

export default function AdminExtensionsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Holding extensions"
        description="Aggregators asking to keep a piece past its placement window. Approve to move the end date on 30 days, or decline with a reason."
      />
      <AdminExtensionsBoard />
    </div>
  );
}
