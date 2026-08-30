import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { artistDashboardService } from "@/services/artistDashboardService";

// Named "Account" rather than "Profile" to avoid colliding with
// hooks/useArtistProfile.ts, which is for *viewing another artist's* public
// profile (Marketplace/Artist Directory) — a different domain entirely from
// the logged-in artist's own Profile & KYC form this file backs.
export function useArtistAccountProfile() {
  return useQuery({
    queryKey: ["artist-account-profile"],
    queryFn: () => artistDashboardService.getProfile(),
  });
}

export function useSaveArtistProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      patch: Parameters<typeof artistDashboardService.updateProfile>[0],
    ) => artistDashboardService.updateProfile(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-account-profile"] });
    },
  });
}

export function useAcceptMouMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Parameters<typeof artistDashboardService.acceptMou>[0],
    ) => artistDashboardService.acceptMou(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-account-profile"] });
      queryClient.invalidateQueries({ queryKey: ["artist-activity"] });
    },
  });
}

// --- Account deactivation ---------------------------------------------------

export function useDeactivationRequest() {
  return useQuery({
    queryKey: ["artist-deactivation-request"],
    queryFn: () => artistDashboardService.getDeactivationRequest(),
  });
}

function useDeactivationMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["artist-deactivation-request"],
      });
      queryClient.invalidateQueries({ queryKey: ["artist-activity"] });
    },
  });
}

export function useRequestDeactivationMutation() {
  return useDeactivationMutation((input: { reason: string }) =>
    artistDashboardService.requestDeactivation(input),
  );
}

export function useWithdrawDeactivationMutation() {
  return useDeactivationMutation((requestId: string) =>
    artistDashboardService.withdrawDeactivation(requestId),
  );
}
