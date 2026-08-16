import { useQuery } from "@tanstack/react-query";
import { aggregatorSalesService } from "@/services/aggregatorSalesService";

// Live summary derived from sales/wallet/holdings. Task 7's analytics page
// may add pre-baked demo chart series on top; this hook stays the real KPI
// source for counts that must match Orders & Sales / Wallet.
export function useAggregatorAnalytics() {
  return useQuery({
    queryKey: ["aggregator-analytics"],
    queryFn: () => aggregatorSalesService.getAnalytics(),
  });
}
