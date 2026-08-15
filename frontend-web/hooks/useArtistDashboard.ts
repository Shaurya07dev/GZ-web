import { useQuery } from "@tanstack/react-query";
import { artistDashboardService } from "@/services/artistDashboardService";

export function useArtistKpiMetrics() {
  return useQuery({
    queryKey: ["artist-kpis"],
    queryFn: () => artistDashboardService.getKpiMetrics(),
  });
}

export function useArtistActivity() {
  return useQuery({
    queryKey: ["artist-activity"],
    queryFn: () => artistDashboardService.getActivity(),
  });
}
