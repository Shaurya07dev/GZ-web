import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orderService, type CreateOrderPayload } from "@/services/orderService";

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => orderService.list(),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: () => orderService.get(id),
  });
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => orderService.create(payload),
    onSuccess: (_order, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["artworks"] });
      queryClient.invalidateQueries({
        queryKey: ["artwork", variables.artworkId],
      });
      queryClient.invalidateQueries({ queryKey: ["artist-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["artist-artworks"] });
    },
  });
}
