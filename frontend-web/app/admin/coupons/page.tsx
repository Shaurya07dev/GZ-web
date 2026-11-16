import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { CouponsPanel } from "@/features/admin/commerce/coupons-panel";

export const metadata = {
  title: "Coupons | GalleryZone Admin",
};

export default function AdminCouponsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Coupons"
        description="Marketplace discount codes. The discount comes out of GalleryZone's margin — artist and aggregator payouts are untouched."
      />
      <CouponsPanel />
    </div>
  );
}
