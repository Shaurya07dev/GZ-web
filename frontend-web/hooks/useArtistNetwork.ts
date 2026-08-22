import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { artistNetworkService } from "@/services/artistNetworkService";

// Ratings, connections and collaborations. Page → Hook → Service, like every
// other data path here; components never call the service directly.

export function useArtistRating(artistId: string) {
  return useQuery({
    queryKey: ["artist-rating", artistId],
    queryFn: () => artistNetworkService.getRating(artistId),
  });
}

export function useArtistReviews(artistId: string) {
  return useQuery({
    queryKey: ["artist-reviews", artistId],
    queryFn: () => artistNetworkService.listReviews(artistId),
  });
}

/** Admin's whole-platform view, keyed by AdminUser id. */
export function useArtistRatingsByUserId(userIds: string[]) {
  const key = [...userIds].sort().join(",");
  return useQuery({
    queryKey: ["artist-ratings-by-user", key],
    queryFn: () => artistNetworkService.listRatingsByUserId(userIds),
    enabled: userIds.length > 0,
  });
}

export function useArtistConnections(artistId: string) {
  return useQuery({
    queryKey: ["artist-connections", artistId],
    queryFn: () => artistNetworkService.listConnections(artistId),
  });
}

export function useConnectionWith(viewerId: string | null, peerId: string) {
  return useQuery({
    queryKey: ["artist-connection-with", viewerId, peerId],
    queryFn: () => artistNetworkService.getConnectionWith(viewerId!, peerId),
    enabled: Boolean(viewerId),
  });
}

// Every connection write invalidates both the list and the single-pair read:
// the public profile button and the dashboard panel are two views of one
// record, and leaving either stale is what makes an accepted request still
// look pending.
function useConnectionMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-connections"] });
      queryClient.invalidateQueries({ queryKey: ["artist-connection-with"] });
    },
  });
}

export function useSendConnectionRequestMutation() {
  return useConnectionMutation(
    (input: {
      requesterId: string;
      recipientId: string;
      message?: string;
    }) => artistNetworkService.sendConnectionRequest(input),
  );
}

export function useRespondToConnectionMutation() {
  return useConnectionMutation(
    (input: { connectionId: string; viewerId: string; accept: boolean }) =>
      artistNetworkService.respondToConnection(input),
  );
}

export function useArtistCollaborations(artistId: string) {
  return useQuery({
    queryKey: ["artist-collaborations", artistId],
    queryFn: () => artistNetworkService.listCollaborations(artistId),
  });
}

function useCollaborationMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-collaborations"] });
    },
  });
}

export function useProposeCollaborationMutation() {
  return useCollaborationMutation(
    (input: {
      proposerId: string;
      partnerId: string;
      title: string;
      brief: string;
    }) => artistNetworkService.proposeCollaboration(input),
  );
}

export function useRespondToCollaborationMutation() {
  return useCollaborationMutation(
    (input: { collaborationId: string; viewerId: string; accept: boolean }) =>
      artistNetworkService.respondToCollaboration(input),
  );
}

export function useCompleteCollaborationMutation() {
  return useCollaborationMutation(
    (input: { collaborationId: string; viewerId: string }) =>
      artistNetworkService.completeCollaboration(input),
  );
}
