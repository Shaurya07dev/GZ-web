import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aggregatorProfileService } from "@/services/aggregatorProfileService";

export function useAggregatorProfile() {
  return useQuery({
    queryKey: ["aggregator-profile"],
    queryFn: () => aggregatorProfileService.getProfile(),
  });
}

export function useUpdateAggregatorProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      patch: Parameters<typeof aggregatorProfileService.updateProfile>[0],
    ) => aggregatorProfileService.updateProfile(patch),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["aggregator-profile"] }),
  });
}
