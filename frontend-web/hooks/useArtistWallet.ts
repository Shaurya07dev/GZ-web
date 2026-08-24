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

export function usePendingSettlements() {
  return useQuery({
    queryKey: ["artist-pending-settlements"],
    queryFn: () => artistDashboardService.listPendingSettlements(),
  });
}

// Demo only. Backdates delivery so the 7-day payout clock has already run out
// and the money moves from pending to available where it can be seen.
export function useSimulateDeliveryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: string) =>
      artistDashboardService.simulateDelivery(settlementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-wallet"] });
      queryClient.invalidateQueries({
        queryKey: ["artist-wallet-transactions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["artist-pending-settlements"],
      });
      queryClient.invalidateQueries({ queryKey: ["artist-activity"] });
    },
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
