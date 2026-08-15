import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/adminService";

export function useAdminOrders() {
  return useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => adminService.listOrders(),
  });
}

export function useAdminOrder(orderId: string) {
  return useQuery({
    queryKey: ["admin-order", orderId],
    queryFn: () => adminService.getOrderAdmin(orderId),
    enabled: Boolean(orderId),
  });
}

export function useAdminAddress(addressId: string) {
  return useQuery({
    queryKey: ["admin-address", addressId],
    queryFn: () => adminService.getAddressAdmin(addressId),
    enabled: Boolean(addressId),
  });
}

export function useAdminSettlementByOrder(orderId: string) {
  return useQuery({
    queryKey: ["admin-settlement-by-order", orderId],
    queryFn: () => adminService.getSettlementByOrder(orderId),
    enabled: Boolean(orderId),
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
