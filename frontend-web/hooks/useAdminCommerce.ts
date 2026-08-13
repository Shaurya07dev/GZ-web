import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/adminService";

export function useAdminOrders() {
  return useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => adminService.listOrders(),
  });
}

export function useAdminSettlements() {
  return useQuery({
    queryKey: ["admin-settlements"],
    queryFn: () => adminService.listSettlements(),
  });
}

// Only valid on `failed` rows — the service rejects anything else, so the
// retry affordance must only appear on failed settlements.
export function useRetrySettlementMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: string) =>
      adminService.retrySettlement(settlementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settlements"] });
    },
  });
}
