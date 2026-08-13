import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/adminService";
import type { GenerateReportInput, PlatformSettings } from "@/types/admin";

// Seeded historical audit entries only. The audit-logs page merges these with
// useAdminAuditStore().entries (this session's actions, newest first) — there
// is deliberately no mutation hook here, because SAD §8.8 is explicit that no
// API path exists to edit or delete an audit row, so the UI must not imply one.
export function useAdminAuditLog() {
  return useQuery({
    queryKey: ["admin-audit-log"],
    queryFn: () => adminService.listAuditLog(),
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminService.getSettings(),
  });
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<PlatformSettings>) =>
      adminService.updateSettings(patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(["admin-settings"], settings);
    },
  });
}

export function useAdminReports() {
  return useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => adminService.listReports(),
  });
}

export function useGenerateReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateReportInput) =>
      adminService.generateReport(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
  });
}
