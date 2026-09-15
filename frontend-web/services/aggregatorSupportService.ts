import type { SupportTicket } from "@/types/support";
import { supportApi } from "./supportApi";

export interface SubmitAggregatorTicketInput {
  subject: string;
  message: string;
}

// Tickets on the API, scoped to the signed-in account.
export const aggregatorSupportService = {
  listTickets: (): Promise<SupportTicket[]> => supportApi.listTickets(),

  submitTicket: (input: { subject: string; message: string }): Promise<SupportTicket> => {
    if (!input.subject.trim() || !input.message.trim()) return Promise.reject(new Error("Add a subject and a message"));
    return supportApi.submitTicket(input);
  },
};
