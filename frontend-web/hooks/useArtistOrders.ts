import { useQuery } from "@tanstack/react-query";
import { artistDashboardService } from "@/services/artistDashboardService";

export function useArtistOrders() {
  return useQuery({
    queryKey: ["artist-orders"],
    queryFn: () => artistDashboardService.listOrders(),
  });
}
