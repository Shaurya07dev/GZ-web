// Messaging + support — PARITY scope only (see schema/community.ts's own
// header: matches exactly what the mock frontend does today — read+
// markRead inboxes, list+submit tickets, no compose/send or admin
// resolution). Not a guess at the plan's open "Scope calls" question —
// this is the documented default already recorded there, applied rather
// than left unbuilt while waiting on an answer that would only ADD scope,
// never remove it.

import { and, eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { messageThreads, supportTickets } from "./schema/community.ts";

export class MessagingError extends Error {}

export async function listMessages(db: Db, userId: string) {
  return db.select().from(messageThreads).where(eq(messageThreads.userId, userId));
}

export async function markMessageRead(db: Db, userId: string, threadId: string): Promise<void> {
  const result = await db.update(messageThreads).set({ unread: false }).where(and(eq(messageThreads.id, threadId), eq(messageThreads.userId, userId)));
  if (result.count === 0) throw new MessagingError(`No message thread ${threadId} for user ${userId}`);
}

export async function listSupportTickets(db: Db, userId: string) {
  return db.select().from(supportTickets).where(eq(supportTickets.userId, userId));
}

export async function submitSupportTicket(db: Db, userId: string, subject: string, message: string): Promise<{ id: string }> {
  const [row] = await db.insert(supportTickets).values({ userId, subject, message }).returning({ id: supportTickets.id });
  if (!row) throw new MessagingError("insert into support_tickets returned no row");
  return row;
}
