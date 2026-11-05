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
      // A paid order flips the artwork's marketplace visibility. Reset
      // and refetch everything the marketplace, wishlist, cart and
      // dashboards read — belt-and-suspenders so the next page the
      // buyer visits never shows the piece they just bought as still
      // for sale.
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order"] });
      queryClient.invalidateQueries({ queryKey: ["artworks"] });
      queryClient.invalidateQueries({
        queryKey: ["artwork", variables.artworkId],
      });
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["customer-collection"] });
      queryClient.invalidateQueries({ queryKey: ["artist-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["artist-artworks"] });
      queryClient.invalidateQueries({ queryKey: ["artist-orders"] });
      queryClient.invalidateQueries({ queryKey: ["artist-settlements"] });
    },
  });
}
