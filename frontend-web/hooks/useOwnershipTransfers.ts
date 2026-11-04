import { notify } from "@/lib/notify";
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
    onError: notify.error("Transfer not started"),
    onSuccess: () => {
      notify.success("Transfer invitation sent", "They'll get an email and can accept from their account.");
      invalidateOwnership(queryClient);
    },
  });
}

export function useAcceptTransferMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transferId: string) => ownershipService.accept(transferId),
    onError: notify.error("Couldn't accept the transfer"),
    onSuccess: (transfer) => {
      if (transfer.status === "awaiting_payment") {
        notify.success(
          "Confirmed — waiting on payment",
          "Ownership passes once the sender pays the GalleryZone transfer fee.",
        );
      } else {
        notify.success(
          "Transfer accepted",
          "The provenance passport now shows you as the owner.",
        );
      }
      invalidateOwnership(queryClient);
    },
  });
}

export function useStartTransferFeeSession() {
  return useMutation({
    mutationFn: (transferId: string) => ownershipService.startFeeSession(transferId),
    onError: notify.error("Couldn't start the transfer fee payment"),
  });
}

export function useVerifyTransferFeePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transferId: string) => ownershipService.verifyFeePayment(transferId),
    onError: notify.error("Couldn't verify the transfer fee payment"),
    onSuccess: (transfer) => {
      if (transfer.status === "accepted") {
        notify.success(
          "Transfer complete",
          "The artwork has passed to the new owner.",
        );
      }
      invalidateOwnership(queryClient);
    },
  });
}

export function useEndDisplayMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transferId: string) => ownershipService.endDisplay(transferId),
    onError: notify.error("Couldn't end the display"),
    onSuccess: () => {
      notify.success("Display ended");
      invalidateOwnership(queryClient);
    },
  });
}

export function useCancelTransferMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transferId: string) => ownershipService.cancel(transferId),
    onError: notify.error("Couldn't cancel the transfer"),
    onSuccess: () => {
      notify.success("Transfer cancelled");
      invalidateOwnership(queryClient);
    },
  });
}
