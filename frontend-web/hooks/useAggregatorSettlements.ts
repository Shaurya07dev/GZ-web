import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aggregatorSalesService } from "@/services/aggregatorSalesService";

export function useAggregatorSettlements() {
  return useQuery({
    queryKey: ["aggregator-settlements"],
    queryFn: () => aggregatorSalesService.listSettlements(),
  });
}

export function useRemittancesDue() {
  return useQuery({
    queryKey: ["aggregator-remittances"],
    queryFn: () => aggregatorSalesService.listRemittancesDue(),
  });
}

export function useRazorpayRemittanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (saleIds: string[]) =>
      aggregatorSalesService.payRemittanceViaRazorpay(saleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aggregator-remittances"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-settlements"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-sales"] });
    },
  });
}

export function useProcessSettlementMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (saleId: string) =>
      aggregatorSalesService.processSettlement(saleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aggregator-settlements"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-wallet"] });
      queryClient.invalidateQueries({
        queryKey: ["aggregator-wallet-transactions"],
      });
    },
  });
}
