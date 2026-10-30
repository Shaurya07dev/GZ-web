import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "@/services/notificationsService";

const KEY = ["notifications"];

// Polled once a minute while the tab is open; no push channel exists on the web yet.
export function useNotifications() {
  return useQuery({ queryKey: KEY, queryFn: notificationsService.list, refetchInterval: 60_000 });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: notificationsService.markRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }) });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: notificationsService.markAllRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }) });
}
