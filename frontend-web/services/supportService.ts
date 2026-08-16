import type { SupportTicket } from "@/types/support";
import { mockDelay, mockError } from "@/lib/mock-utils";
import { artistSupportTicketsCol } from "@/lib/mock-collections";

export interface SubmitTicketInput {
  subject: string;
  message: string;
}

// Own file, not folded into artistDashboardService.ts — a distinct
// actor-facing domain, same reasoning as messagesService.ts.
export const supportService = {
  listTickets: (): Promise<SupportTicket[]> =>
    mockDelay(artistSupportTicketsCol.get()),

  submitTicket: (input: SubmitTicketInput): Promise<SupportTicket> => {
    if (!input.subject.trim()) return mockError("A subject is required");
    if (!input.message.trim()) return mockError("Enter a message");

    const ticket: SupportTicket = {
      id: `ticket-${crypto.randomUUID().slice(0, 8)}`,
      subject: input.subject.trim(),
      message: input.message.trim(),
      status: "open",
      createdAt: new Date().toISOString(),
    };
    artistSupportTicketsCol.set([ticket, ...artistSupportTicketsCol.get()]);
    return mockDelay(ticket);
  },
};
