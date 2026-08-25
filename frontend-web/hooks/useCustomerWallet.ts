import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerWalletService } from "@/services/customerWalletService";

export function useCustomerWallet() {
  return useQuery({
    queryKey: ["customer-wallet"],
    queryFn: () => customerWalletService.getWallet(),
  });
}

export function useCustomerWalletTransactions() {
  return useQuery({
    queryKey: ["customer-wallet-transactions"],
    queryFn: () => customerWalletService.listTransactions(),
  });
}

export function useCustomerWithdrawalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      customerWalletService.requestWithdrawal(amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-wallet"] });
      queryClient.invalidateQueries({
        queryKey: ["customer-wallet-transactions"],
      });
    },
  });
}
