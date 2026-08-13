import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { UserTable } from "@/features/admin/people/user-table";

export const metadata = {
  title: "Aggregators — GalleryZone Admin",
};

export default function AdminAggregatorsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Aggregators"
        description="Galleries and distributors holding work on consignment."
      />
      <UserTable role="aggregator" />
    </div>
  );
}
