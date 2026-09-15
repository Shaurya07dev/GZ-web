import type { SupportTicket } from "@/types/support";
import { supportApi } from "./supportApi";

export interface SubmitCustomerTicketInput {
  subject: string;
  message: string;
}

// Tickets on the API, scoped to the signed-in account.
export const customerSupportService = {
  listTickets: (): Promise<SupportTicket[]> => supportApi.listTickets(),

  submitTicket: (input: { subject: string; message: string }): Promise<SupportTicket> => {
    if (!input.subject.trim() || !input.message.trim()) return Promise.reject(new Error("Add a subject and a message"));
    return supportApi.submitTicket(input);
  },
};
