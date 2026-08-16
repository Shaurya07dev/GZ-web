import { useQuery } from "@tanstack/react-query";
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
