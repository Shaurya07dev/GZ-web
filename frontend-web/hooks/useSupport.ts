import { notify } from "@/lib/notify";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supportService,
  type SubmitTicketInput,
} from "@/services/supportService";

export function useSupportTickets() {
  return useQuery({
    queryKey: ["artist-support-tickets"],
    queryFn: () => supportService.listTickets(),
  });
}

export function useSubmitTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitTicketInput) => supportService.submitTicket(input),
    onError: notify.error("Ticket not sent"),
    onSuccess: () => {
      notify.success("Ticket sent", "Support replies by email, usually within a working day.");
      queryClient.invalidateQueries({ queryKey: ["artist-support-tickets"] });
    },
  });
}
