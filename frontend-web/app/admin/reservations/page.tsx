import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { ReservationsTable } from "@/features/admin/commerce/reservations-table";

export const metadata = {
  title: "Reservations | GalleryZone Admin",
};

export default function AdminReservationsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reservations"
        description="Every active aggregator reservation with the full money flow. Advance + delivery deposit = total in escrow. Released on sale (advance returns, delivery consumed) or return (advance returns, delivery forfeited)."
      />
      <ReservationsTable />
    </div>
  );
}
