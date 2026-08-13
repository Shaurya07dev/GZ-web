import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { SettingsForm } from "@/features/admin/system/settings-form";

export const metadata = {
  title: "Settings — GalleryZone Admin",
};

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform settings"
        description="Pricing, commission, and payout rules. Changes apply to new listings and settlements."
      />
      <SettingsForm />
    </div>
  );
}
