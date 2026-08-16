import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aggregatorMessagesService } from "@/services/aggregatorMessagesService";

export function useAggregatorMessages() {
  return useQuery({
    queryKey: ["aggregator-messages"],
    queryFn: () => aggregatorMessagesService.list(),
  });
}

export function useMarkAggregatorMessageReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aggregatorMessagesService.markRead(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["aggregator-messages"] }),
  });
}
