import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aggregatorSalesService } from "@/services/aggregatorSalesService";

export function useAggregatorSales() {
  return useQuery({
    queryKey: ["aggregator-sales"],
    queryFn: () => aggregatorSalesService.listSales(),
  });
}

export function useAggregatorShipments() {
  return useQuery({
    queryKey: ["aggregator-shipments"],
    queryFn: () => aggregatorSalesService.listShipments(),
  });
}

export function useAdvanceShipmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (saleId: string) =>
      aggregatorSalesService.advanceShipment(saleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aggregator-shipments"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-sales"] });
    },
  });
}
