import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customerSupportService,
  type SubmitCustomerTicketInput,
} from "@/services/customerSupportService";

export function useCustomerSupport() {
  return useQuery({
    queryKey: ["customer-support"],
    queryFn: () => customerSupportService.listTickets(),
  });
}

export function useSubmitCustomerTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitCustomerTicketInput) =>
      customerSupportService.submitTicket(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["customer-support"] }),
  });
}
