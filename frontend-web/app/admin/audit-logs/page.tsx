import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { AuditLogTable } from "@/features/admin/system/audit-log-table";

export const metadata = {
  title: "Audit logs — GalleryZone Admin",
};

export default function AdminAuditLogsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Audit logs"
        description="Every state-changing action taken in this console, who took it, and when."
      />
      <AuditLogTable />
    </div>
  );
}
