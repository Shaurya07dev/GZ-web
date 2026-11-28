import { useQuery } from "@tanstack/react-query";
import { adminReservationsService } from "@/services/adminReservationsService";

export function useAdminReservations() {
  return useQuery({
    queryKey: ["admin-reservations"],
    queryFn: () => adminReservationsService.list(),
  });
}
