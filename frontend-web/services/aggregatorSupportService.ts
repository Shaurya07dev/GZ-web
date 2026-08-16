import type { SupportTicket } from "@/types/support";
import { mockDelay, mockError } from "@/lib/mock-utils";
import { aggregatorSupportTicketsCol } from "@/lib/mock-collections";

export interface SubmitAggregatorTicketInput {
  subject: string;
  message: string;
}

// Own file, not folded into aggregatorService.ts — a distinct actor-facing
// domain, same reasoning as supportService.ts / aggregatorMessagesService.ts.
export const aggregatorSupportService = {
  listTickets: (): Promise<SupportTicket[]> =>
    mockDelay(aggregatorSupportTicketsCol.get()),

  submitTicket: (
    input: SubmitAggregatorTicketInput,
  ): Promise<SupportTicket> => {
    if (!input.subject.trim()) return mockError("A subject is required");
    if (!input.message.trim()) return mockError("Enter a message");

    const ticket: SupportTicket = {
      id: `ticket-${crypto.randomUUID().slice(0, 8)}`,
      subject: input.subject.trim(),
      message: input.message.trim(),
      status: "open",
      createdAt: new Date().toISOString(),
    };
    aggregatorSupportTicketsCol.set([
      ticket,
      ...aggregatorSupportTicketsCol.get(),
    ]);
    return mockDelay(ticket);
  },
};
