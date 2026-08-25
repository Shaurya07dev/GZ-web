import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aggregatorSalesService } from "@/services/aggregatorSalesService";

export function useAggregatorWallet() {
  return useQuery({
    queryKey: ["aggregator-wallet"],
    queryFn: () => aggregatorSalesService.listWallet(),
  });
}

// Topping up frees capacity to reserve, so Inventory has to re-evaluate too.
export function useAddAggregatorFundsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) => aggregatorSalesService.addFunds(amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aggregator-wallet"] });
      queryClient.invalidateQueries({
        queryKey: ["aggregator-wallet-transactions"],
      });
      queryClient.invalidateQueries({ queryKey: ["aggregator-inventory"] });
    },
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
