import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { artistDashboardService } from "@/services/artistDashboardService";

export function useArtistWallet() {
  return useQuery({
    queryKey: ["artist-wallet"],
    queryFn: () => artistDashboardService.getWallet(),
  });
}

export function useArtistWalletTransactions() {
  return useQuery({
    queryKey: ["artist-wallet-transactions"],
    queryFn: () => artistDashboardService.listWalletTransactions(),
  });
}

export function useRequestWithdrawalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      artistDashboardService.requestWithdrawal(amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-wallet"] });
      queryClient.invalidateQueries({
        queryKey: ["artist-wallet-transactions"],
      });
      queryClient.invalidateQueries({ queryKey: ["artist-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["artist-activity"] });
    },
  });
}
