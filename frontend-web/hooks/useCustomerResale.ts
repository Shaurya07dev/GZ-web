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

export function useWithdrawResaleListingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerResaleService.withdrawListing(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["customer-resale-listings"] }),
  });
}
