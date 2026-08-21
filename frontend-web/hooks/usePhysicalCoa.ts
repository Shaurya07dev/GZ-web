import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { physicalCoaService } from "@/services/physicalCoaService";

export function useArtworkCoaRequests(artworkId: string) {
  return useQuery({
    queryKey: ["physical-coa", artworkId],
    queryFn: () => physicalCoaService.listForArtwork(artworkId),
    enabled: Boolean(artworkId),
  });
}

export function useArtistCoaRequests() {
  return useQuery({
    queryKey: ["physical-coa", "artist"],
    queryFn: () => physicalCoaService.listForArtist(),
  });
}

export function useRequestPhysicalCoaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof physicalCoaService.request>[0]) =>
      physicalCoaService.request(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["physical-coa"] }),
  });
}

export function useMarkCoaDispatchedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Parameters<typeof physicalCoaService.markDispatched>[0],
    ) => physicalCoaService.markDispatched(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["physical-coa"] }),
  });
}
