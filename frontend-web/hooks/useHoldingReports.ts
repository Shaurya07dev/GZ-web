import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { holdingReportsService, type CreateHoldingReportInput } from "@/services/holdingReportsService";
import type { HoldingReportStatus } from "@/types/holding-report";

export function useCreateHoldingReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHoldingReportInput) => holdingReportsService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-holding-reports"] });
    },
  });
}

export function useAdminHoldingReports(status?: HoldingReportStatus) {
  return useQuery({
    queryKey: ["admin-holding-reports", status ?? "all"],
    queryFn: () => holdingReportsService.listForAdmin(status),
  });
}

export function useResolveHoldingReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, note }: { reportId: string; note?: string }) =>
      holdingReportsService.resolve(reportId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-holding-reports"] });
    },
  });
}
