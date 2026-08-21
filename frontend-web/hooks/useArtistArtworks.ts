import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  artistDashboardService,
  type SubmitArtworkInput,
} from "@/services/artistDashboardService";

// Named distinctly from hooks/useArtistProfile.ts's useArtistArtworks(id) —
// that one fetches ANOTHER artist's public listings (marketplace "more from
// this artist" rail); this one is the logged-in artist's own dashboard list.
export function useArtistDashboardArtworks() {
  return useQuery({
    queryKey: ["artist-artworks"],
    queryFn: () => artistDashboardService.listArtworks(),
  });
}

// Submitting changes the pending-approval count (KPI tile) and the activity
// feed, so both get invalidated alongside the artworks list itself.
export function useSubmitArtworkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitArtworkInput) =>
      artistDashboardService.submitArtwork(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-artworks"] });
      queryClient.invalidateQueries({ queryKey: ["artist-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["artist-activity"] });
      queryClient.invalidateQueries({ queryKey: ["artist-penalties"] });
      queryClient.invalidateQueries({ queryKey: ["artist-wallet"] });
    },
  });
}

// Editing an existing listing. Same invalidations as submitting: the list,
// the KPI tile and the activity feed all reflect it.
export function useUpdateArtworkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof artistDashboardService.updateArtwork>[0]) =>
      artistDashboardService.updateArtwork(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-artworks"] });
      queryClient.invalidateQueries({ queryKey: ["artist-activity"] });
      queryClient.invalidateQueries({ queryKey: ["artwork"] });
    },
  });
}

// Demo-only instant approval — see the service note.
export function useSelfApproveArtworkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (artworkId: string) =>
      artistDashboardService.selfApproveArtwork(artworkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-artworks"] });
      queryClient.invalidateQueries({ queryKey: ["artist-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["artist-activity"] });
      queryClient.invalidateQueries({ queryKey: ["artworks"] });
    },
  });
}

// Off-platform sale fees owed but not yet charged. Read on the Add Artwork
// form (so the artist sees the fee before listing) and after marking a piece
// sold elsewhere.
export function useArtistPenalties() {
  return useQuery({
    queryKey: ["artist-penalties"],
    queryFn: () => artistDashboardService.listPenalties(),
  });
}

// Marking a piece sold elsewhere removes it from every GalleryZone channel
// and queues a fee, so the artworks list, KPIs, activity feed and penalty
// list all go stale at once.
export function useMarkSoldElsewhereMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (artworkId: string) =>
      artistDashboardService.markSoldElsewhere(artworkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-artworks"] });
      queryClient.invalidateQueries({ queryKey: ["artist-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["artist-activity"] });
      queryClient.invalidateQueries({ queryKey: ["artist-penalties"] });
    },
  });
}
