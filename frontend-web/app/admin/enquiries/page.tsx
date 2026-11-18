import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { EnquiriesView } from "@/features/admin/enquiries/enquiries-view";

export const metadata = {
  title: "Enquiries | GalleryZone Admin",
};

export default function AdminEnquiriesPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Enquiries"
        description="Everything sent through the Get in touch form: advertisement, collaboration, general questions and support. Filter by what it is about."
      />
      <EnquiriesView />
    </div>
  );
}
