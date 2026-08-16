import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { messagesService } from "@/services/messagesService";

export function useArtistMessages() {
  return useQuery({
    queryKey: ["artist-messages"],
    queryFn: () => messagesService.list(),
  });
}

export function useMarkMessageReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messagesService.markRead(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["artist-messages"] }),
  });
}
