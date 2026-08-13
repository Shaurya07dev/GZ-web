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
