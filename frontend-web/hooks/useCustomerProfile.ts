import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import type { CustomerProfile } from "@/types/customer";

export function useCustomerProfile() {
  return useQuery({
    queryKey: ["customer-profile"],
    queryFn: () => customerService.getProfile(),
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<CustomerProfile>) => customerService.updateProfile(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-profile"] });
    },
  });
}
