export type SupportTicketStatus = "open" | "answered" | "closed";

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  createdAt: string; // ISO
}
