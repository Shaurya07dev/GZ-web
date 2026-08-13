import { useQuery } from "@tanstack/react-query";
import { aggregatorService } from "@/services/aggregatorService";

export function useAggregatorDashboard() {
  return useQuery({
    queryKey: ["aggregator-dashboard"],
    queryFn: () => aggregatorService.dashboardSummary(),
  });
}
