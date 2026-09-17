import { notify } from "@/lib/notify";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { artistDashboardService } from "@/services/artistDashboardService";

export function useArtistSettings() {
  return useQuery({
    queryKey: ["artist-settings"],
    queryFn: () => artistDashboardService.getSettings(),
  });
}

export function useUpdateArtistSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      patch: Partial<Awaited<ReturnType<typeof artistDashboardService.getSettings>>>,
    ) => artistDashboardService.updateSettings(patch),
    onError: notify.error("Settings not saved"),
    onSuccess: () => {
      notify.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["artist-settings"] });
    },
  });
}
