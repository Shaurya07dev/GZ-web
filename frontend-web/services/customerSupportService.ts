import type { SupportTicket } from "@/types/support";
import { mockDelay, mockError } from "@/lib/mock-utils";
import { customerSupportTicketsCol } from "@/lib/mock-collections";

export interface SubmitCustomerTicketInput {
  subject: string;
  message: string;
}

// Own file, not folded into customerService.ts — same reasoning as the
// Aggregator/Artist tracks' separate support services.
export const customerSupportService = {
  listTickets: (): Promise<SupportTicket[]> =>
    mockDelay(customerSupportTicketsCol.get()),

  submitTicket: (input: SubmitCustomerTicketInput): Promise<SupportTicket> => {
    if (!input.subject.trim()) return mockError("A subject is required");
    if (!input.message.trim()) return mockError("Enter a message");

    const ticket: SupportTicket = {
      id: `cust-ticket-${crypto.randomUUID().slice(0, 8)}`,
      subject: input.subject.trim(),
      message: input.message.trim(),
      status: "open",
      createdAt: new Date().toISOString(),
    };
    customerSupportTicketsCol.set([
      ticket,
      ...customerSupportTicketsCol.get(),
    ]);
    return mockDelay(ticket);
  },
};
