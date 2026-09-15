// Support tickets and the inbox on the API — shared by the artist,
// aggregator and collector portals (the routes are scoped to the caller).
import type { SupportTicket } from "@/types/support";
import type { MessageThread } from "@/types/message";
import { http } from "@/lib/api";

type Ts = { _seconds: number } | string | null | undefined;
const iso = (t: Ts): string => (typeof t === "string" ? t : t ? new Date(t._seconds * 1000).toISOString() : new Date(0).toISOString());

interface TicketDto { id: string; subject: string; message: string; status: "open" | "answered" | "closed"; createdAt: Ts }
interface ThreadDto { id: string; fromLabel: string; subject: string; preview: string; body: string; unread: boolean; receivedAt: Ts }


export const supportApi = {
  async listTickets(): Promise<SupportTicket[]> {
    const rows = await http.get<TicketDto[]>("/v1/support");
    return rows.map((t) => ({ id: t.id, subject: t.subject, message: t.message, status: t.status, createdAt: iso(t.createdAt) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async submitTicket(input: { subject: string; message: string }): Promise<SupportTicket> {
    const { id } = await http.post<{ id: string }>("/v1/support", { subject: input.subject.trim(), message: input.message.trim() });
    return { id, subject: input.subject.trim(), message: input.message.trim(), status: "open", createdAt: new Date().toISOString() };
  },
  async listMessages(): Promise<MessageThread[]> {
    const rows = await http.get<ThreadDto[]>("/v1/messages");
    return rows.map((m) => ({ id: m.id, from: m.fromLabel, subject: m.subject, preview: m.preview, body: m.body, unread: m.unread, receivedAt: iso(m.receivedAt) })).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  },
  async markRead(id: string): Promise<MessageThread | undefined> {
    await http.post(`/v1/messages/${encodeURIComponent(id)}/read`);
    return (await supportApi.listMessages()).find((m) => m.id === id);
  },
};
