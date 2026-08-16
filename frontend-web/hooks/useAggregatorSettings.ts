import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aggregatorSettingsService } from "@/services/aggregatorSettingsService";

export function useAggregatorSettings() {
  return useQuery({
    queryKey: ["aggregator-settings"],
    queryFn: () => aggregatorSettingsService.getSettings(),
  });
}

export function useUpdateAggregatorSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      patch: Partial<
        Awaited<ReturnType<typeof aggregatorSettingsService.getSettings>>
      >,
    ) => aggregatorSettingsService.updateSettings(patch),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["aggregator-settings"] }),
  });
}
