import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/notify";
import { broadcastService } from "@/services/broadcastService";

export function useBroadcastReach() {
  return useQuery({ queryKey: ["admin-broadcast-reach"], queryFn: () => broadcastService.reach() });
}

export function useBroadcasts() {
  return useQuery({ queryKey: ["admin-broadcasts"], queryFn: () => broadcastService.list() });
}

export function useSendBroadcastMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: broadcastService.send,
    onSuccess: ({ recipientCount }) => {
      notify.success("Message sent", `${recipientCount} ${recipientCount === 1 ? "person" : "people"} will see it in their Messages.`);
      queryClient.invalidateQueries({ queryKey: ["admin-broadcasts"] });
    },
    onError: notify.error("Message not sent"),
  });
}
