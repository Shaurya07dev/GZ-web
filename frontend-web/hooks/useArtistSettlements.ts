import { useQuery } from "@tanstack/react-query";
import { artistDashboardService } from "@/services/artistDashboardService";

export function useArtistSettlements() {
  return useQuery({
    queryKey: ["artist-settlements"],
    queryFn: () => artistDashboardService.listSettlements(),
  });
}
