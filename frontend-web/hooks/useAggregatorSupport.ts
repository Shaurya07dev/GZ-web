import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  aggregatorSupportService,
  type SubmitAggregatorTicketInput,
} from "@/services/aggregatorSupportService";

export function useAggregatorSupport() {
  return useQuery({
    queryKey: ["aggregator-support"],
    queryFn: () => aggregatorSupportService.listTickets(),
  });
}

export function useSubmitAggregatorTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitAggregatorTicketInput) =>
      aggregatorSupportService.submitTicket(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["aggregator-support"] }),
  });
}
