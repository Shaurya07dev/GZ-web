import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { AdminBlogsQueue } from "@/features/admin/moderation/admin-blogs-queue";

export const metadata = {
  title: "Blog review | GalleryZone Admin",
};

export default function AdminBlogsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Blog review"
        description="Artist-submitted posts. Accept to publish on /blogs, or reject with a reason the author can see."
      />
      <AdminBlogsQueue />
    </div>
  );
}
