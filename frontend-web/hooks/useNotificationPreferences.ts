import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/api";

export interface NotificationPreferences {
  abandonedCart: boolean;
  marketing: boolean;
  weeklyDigest: boolean;
  pushEnabled: boolean;
}

const QUERY_KEY = ["notification-preferences"] as const;

export function useNotificationPreferences() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => http.get<NotificationPreferences>("/v1/account/notifications/preferences"),
    staleTime: 60_000,
  });
}

export function useUpdateNotificationPreferencesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      http.patch<NotificationPreferences>("/v1/account/notifications/preferences", patch),
    onSuccess: (next) => qc.setQueryData(QUERY_KEY, next),
  });
}
