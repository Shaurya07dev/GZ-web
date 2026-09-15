import type { SupportTicket } from "@/types/support";
import { supportApi } from "./supportApi";

export interface SubmitTicketInput {
  subject: string;
  message: string;
}

// Tickets on the API, scoped to the signed-in account.
export const supportService = {
  listTickets: (): Promise<SupportTicket[]> => supportApi.listTickets(),

  submitTicket: (input: { subject: string; message: string }): Promise<SupportTicket> => {
    if (!input.subject.trim() || !input.message.trim()) return Promise.reject(new Error("Add a subject and a message"));
    return supportApi.submitTicket(input);
  },
};
