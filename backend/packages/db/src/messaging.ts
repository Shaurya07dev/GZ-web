// Messaging + support — PARITY scope only, same as the Postgres version
// (see collections.ts's own header). Firestore version.

import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { Collections, type MessageThreadDoc, type SupportTicketDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class MessagingError extends DbError {}

export async function listMessages(db: Firestore, userId: string): Promise<(MessageThreadDoc & { id: string })[]> {
  const snap = await db.collection(Collections.messageThreads).where("userId", "==", userId).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as MessageThreadDoc) }));
}

export async function markMessageRead(db: Firestore, userId: string, threadId: string): Promise<void> {
  const ref = db.collection(Collections.messageThreads).doc(threadId);
  const snap = await ref.get();
  if (!snap.exists || (snap.data() as MessageThreadDoc).userId !== userId) {
    throw new MessagingError(`No message thread ${threadId} for user ${userId}`);
  }
  await ref.update({ unread: false });
}

export async function listSupportTickets(db: Firestore, userId: string): Promise<(SupportTicketDoc & { id: string })[]> {
  const snap = await db.collection(Collections.supportTickets).where("userId", "==", userId).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as SupportTicketDoc) }));
}

export async function submitSupportTicket(db: Firestore, userId: string, subject: string, message: string): Promise<{ id: string }> {
  const ref = db.collection(Collections.supportTickets).doc();
  const doc: SupportTicketDoc = { userId, subject, message, status: "open", createdAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp };
  await ref.set(doc);
  return { id: ref.id };
}
