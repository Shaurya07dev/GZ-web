import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customerResaleService,
  type CreateResaleListingInput,
} from "@/services/customerResaleService";

export function useCustomerResaleListings() {
  return useQuery({
    queryKey: ["customer-resale-listings"],
    queryFn: () => customerResaleService.listListings(),
  });
}

export function useCreateResaleListingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateResaleListingInput) =>
      customerResaleService.createListing(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["customer-resale-listings"] }),
  });
}

// Demo only: no second collector exists to buy the piece, so this stands in
// for one. Credits the seller's wallet, which is the part that matters.
export function useCompleteResaleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerResaleService.completeSale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-resale-listings"] });
      queryClient.invalidateQueries({ queryKey: ["customer-wallet"] });
      queryClient.invalidateQueries({
        queryKey: ["customer-wallet-transactions"],
      });
    },
  });
}

export function useWithdrawResaleListingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerResaleService.withdrawListing(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["customer-resale-listings"] }),
  });
}
