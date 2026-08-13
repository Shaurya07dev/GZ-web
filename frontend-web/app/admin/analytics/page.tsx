import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { AnalyticsView } from "@/features/admin/analytics/analytics-view";

export const metadata = {
  title: "Analytics | GalleryZone Admin",
};

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Analytics"
        description="Revenue, volume, catalogue movement, and how the artist base is growing."
      />
      <AnalyticsView />
    </div>
  );
}
