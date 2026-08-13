import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { CategoryManager } from "@/features/admin/catalog/category-manager";

export const metadata = {
  title: "Categories — GalleryZone Admin",
};

export default function AdminCategoriesPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Categories"
        description="How the catalogue is filed. A category holding artworks cannot be deleted."
      />
      <CategoryManager />
    </div>
  );
}
