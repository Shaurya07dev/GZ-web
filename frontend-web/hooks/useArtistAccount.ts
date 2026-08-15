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

export function useSaveArtistBankMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { bankAccountNumber: string; ifsc: string }) =>
      artistDashboardService.updateBankDetails(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-account-profile"] });
    },
  });
}
