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
    },
  });
}
