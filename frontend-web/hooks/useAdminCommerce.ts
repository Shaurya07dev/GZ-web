import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/adminService";
import type { OrderStatus } from "@/types/order";

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

/** Admin confirms a settlement paid out of band — artist royalty rows. */
export function useMarkSettlementPaidMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: string) =>
      adminService.markSettlementPaid(settlementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settlements"] });
    },
  });
}

/**
 * Issue a Razorpay refund on a paid order. Added 8 Nov 2026 — customer
 * refund requests arrived as support tickets and admins processed them by
 * hand in the Razorpay dashboard, with no audit trail on the order. This
 * endpoint does both: calls Razorpay refund and marks the order cancelled
 * with the refund id and reason stamped on the doc.
 */
export function useAdminRefundOrderMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => adminService.refundOrder(orderId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });
}

/**
 * Look up any user (buyer / artist / admin) by uid. Used by the admin
 * order-detail page to show the real buyer rather than the signed-in
 * admin (which was the previous bug: every order looked like it was
 * bought by the admin because the page called useCustomerProfile()).
 */
export function useAdminUser(uid: string | undefined) {
  return useQuery({
    queryKey: ["admin-user", uid],
    queryFn: () => adminService.getUserById(uid!),
    enabled: Boolean(uid),
  });
}

/**
 * Re-run paid-side effects on an order that was manually revived via
 * scripts/revive-order-direct.ts. Settlement, Shiprocket booking, and
 * buyer+artist notifications. Added 16 Nov 2026 after the ₹260.21
 * recovery left those three jobs undone.
 */
export function useAdminFinishRevivedOrderMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminService.finishRevivedOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });
}

/**
 * Walk an order along the fulfilment ladder. Admin-only, backend runs the
 * state-machine assertion and emails the buyer about the new stage.
 */
export function useAdminAdvanceOrderStatusMutation(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (to: OrderStatus) =>
      adminService.advanceOrderStatus(orderId, to),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });
}
