import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { BroadcastView } from "@/features/admin/broadcasts/broadcast-view";

export const metadata = {
  title: "Broadcasts | GalleryZone Admin",
};

export default function AdminBroadcastsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Broadcasts"
        description="Write one message and send it to every artist, every aggregator, or both. It lands in their Messages inbox."
      />
      <BroadcastView />
    </div>
  );
}
