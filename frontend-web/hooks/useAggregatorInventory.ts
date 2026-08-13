import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aggregatorService } from "@/services/aggregatorService";

export function useReservableInventory() {
  return useQuery({
    queryKey: ["aggregator-inventory"],
    queryFn: () => aggregatorService.listReservableInventory(),
  });
}

interface ReserveArtworkInput {
  artworkId: string;
  simulateConflict?: boolean;
}

// Reserving moves an artwork out of Inventory and into Collection, and
// changes the "active reservations" KPI on the Dashboard — all three
// queries are invalidated together so every page reflects the new state on
// its next visit/refetch.
export function useReserveArtworkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artworkId, simulateConflict }: ReserveArtworkInput) =>
      aggregatorService.reserve(artworkId, simulateConflict),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aggregator-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-collection"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-dashboard"] });
    },
  });
}
