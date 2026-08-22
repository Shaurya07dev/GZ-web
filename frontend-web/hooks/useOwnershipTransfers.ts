import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ownershipService } from "@/services/ownershipService";

export function useArtworkTransfers(artworkId: string) {
  return useQuery({
    queryKey: ["ownership-transfers", artworkId],
    queryFn: () => ownershipService.listForArtwork(artworkId),
    enabled: Boolean(artworkId),
  });
}

export function useTransfer(transferId: string) {
  return useQuery({
    queryKey: ["ownership-transfer", transferId],
    queryFn: () => ownershipService.get(transferId),
    enabled: Boolean(transferId),
  });
}

// Accepting rewrites the artwork's custody, so anything showing an owner or a
// passport is stale afterwards.
const OWNERSHIP_KEYS = [
  ["ownership-transfers"],
  ["ownership-transfer"],
  ["artwork"],
  ["artist-artworks"],
  ["customer-collection"],
];

function invalidateOwnership(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of OWNERSHIP_KEYS) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}

export function useInitiateTransferMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof ownershipService.initiate>[0]) =>
      ownershipService.initiate(input),
    onSuccess: () => invalidateOwnership(queryClient),
  });
}

export function useAcceptTransferMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transferId: string) => ownershipService.accept(transferId),
    onSuccess: () => invalidateOwnership(queryClient),
  });
}

export function useEndDisplayMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transferId: string) => ownershipService.endDisplay(transferId),
    onSuccess: () => invalidateOwnership(queryClient),
  });
}

export function useCancelTransferMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transferId: string) => ownershipService.cancel(transferId),
    onSuccess: () => invalidateOwnership(queryClient),
  });
}
