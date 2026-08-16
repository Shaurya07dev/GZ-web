import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aggregatorSalesService } from "@/services/aggregatorSalesService";

export function useAggregatorWallet() {
  return useQuery({
    queryKey: ["aggregator-wallet"],
    queryFn: () => aggregatorSalesService.listWallet(),
  });
}

export function useAggregatorWalletTransactions() {
  return useQuery({
    queryKey: ["aggregator-wallet-transactions"],
    queryFn: () => aggregatorSalesService.listWalletTransactions(),
  });
}

export function useAggregatorRequestWithdrawalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      aggregatorSalesService.requestWithdrawal(amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aggregator-wallet"] });
      queryClient.invalidateQueries({
        queryKey: ["aggregator-wallet-transactions"],
      });
    },
  });
}
