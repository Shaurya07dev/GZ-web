import { useQuery } from "@tanstack/react-query";
import { aggregatorSalesService } from "@/services/aggregatorSalesService";

export function useAggregatorCustomers() {
  return useQuery({
    queryKey: ["aggregator-customers"],
    queryFn: () => aggregatorSalesService.listCustomers(),
  });
}
