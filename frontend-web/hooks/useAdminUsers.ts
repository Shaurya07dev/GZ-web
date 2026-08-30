import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/adminService";
import type { UserRole, UserStatus } from "@/types/admin";

// One list hook, parameterised by role — the Artists / Aggregators /
// Customers pages differ only in that filter, so they share this rather than
// each getting a near-identical hook. `role ?? "all"` keeps the query key
// stably hashable instead of embedding an undefined slot.
export function useAdminUsers(role?: UserRole) {
  return useQuery({
    queryKey: ["admin-users", role ?? "all"],
    queryFn: () => adminService.listUsers(role),
  });
}

export function useAdminUser(userId: string) {
  return useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => adminService.getUser(userId),
    enabled: Boolean(userId),
  });
}

// Person-detail pages: bundles the AdminUser row with the role-specific
// record their page actually renders (portfolio/holdings/orders), through
// adminService instead of the page importing lib/mock-data/* fixtures.
export function useAdminArtistPortfolio(userId: string) {
  return useQuery({
    queryKey: ["admin-artist-portfolio", userId],
    queryFn: () => adminService.getArtistPortfolio(userId),
    enabled: Boolean(userId),
  });
}

export function useAdminAggregatorPortfolio(userId: string) {
  return useQuery({
    queryKey: ["admin-aggregator-portfolio", userId],
    queryFn: () => adminService.getAggregatorPortfolio(userId),
    enabled: Boolean(userId),
  });
}

export function useAdminCustomerPortfolio(userId: string) {
  return useQuery({
    queryKey: ["admin-customer-portfolio", userId],
    queryFn: () => adminService.getCustomerPortfolio(userId),
    enabled: Boolean(userId),
  });
}

// Suspend / activate. Also invalidates ["admin-users"] as a prefix, which
// covers every per-role list at once.
export function useSetUserStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: UserStatus }) =>
      adminService.setUserStatus(userId, status),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
    },
  });
}

// The mock service doesn't persist this back into adminUsersCol (same shape
// as every other admin decision here), so the call site patches its own
// portfolio query cache with the result rather than refetching stale data.
export function useSetEarningsAbove5LMutation() {
  return useMutation({
    mutationFn: ({
      userId,
      earningsAbove5L,
    }: {
      userId: string;
      earningsAbove5L: boolean;
    }) => adminService.setEarningsAbove5L(userId, earningsAbove5L),
  });
}
