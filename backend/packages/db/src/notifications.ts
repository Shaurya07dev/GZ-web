// In-app notifications: the persistent copy of every transactional email, so
// a user sees what happened even if the mail bounced, went to spam, or the
// mail provider was down. One doc per (user, event) under
// users/{uid}/notifications. The doc id is the email's idempotency key, so a
// retried event can never notify twice — and create() (not set()) means a
// retry never resets a notification the user already read.

import { FieldValue, type Firestore, type Timestamp } from "firebase-admin/firestore";
import { Collections, type UserDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class NotificationError extends DbError {}

export const userNotificationsCol = (userId: string) => `users/${userId}/notifications`;

export interface NotificationDoc {
  title: string;
  body: string;
  /** A path on the site ("/account/orders/abc"), or null. */
  url: string | null;
  readAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface NotificationView {
  id: string;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  createdAt: string;
}

// Firestore doc ids can't contain "/", which every idempotency key does.
export const notificationIdFor = (key: string) => key.replace(/\//g, "__").slice(0, 700);

const ALREADY_EXISTS = 6;

/** Notify every account behind these email addresses. Returns how many were newly created. */
export async function recordNotifications(
  db: Firestore,
  input: { key: string; emails: string[]; title: string; body: string; url: string | null },
): Promise<number> {
  // Registration stores the address as typed, so match it as given AND lower-cased.
  const emails = [...new Set(input.emails.flatMap((e) => [e.trim(), e.trim().toLowerCase()]).filter(Boolean))];
  const uids = new Set<string>();
  // "in" takes at most 30 values per query.
  for (let i = 0; i < emails.length; i += 30) {
    const snap = await db.collection(Collections.users).where("email", "in", emails.slice(i, i + 30)).get();
    for (const d of snap.docs) if ((d.data() as UserDoc).email) uids.add(d.id);
  }
  let created = 0;
  for (const uid of uids) {
    const doc: Omit<NotificationDoc, "createdAt"> & { createdAt: FieldValue } = {
      title: input.title.slice(0, 200),
      body: input.body.slice(0, 500),
      url: input.url,
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
    };
    try {
      await db.collection(userNotificationsCol(uid)).doc(notificationIdFor(input.key)).create(doc);
      created++;
    } catch (error) {
      if ((error as { code?: number }).code !== ALREADY_EXISTS) throw error;
    }
  }
  return created;
}

export async function listNotifications(db: Firestore, uid: string, limit = 30): Promise<{ items: NotificationView[]; unreadCount: number }> {
  const col = db.collection(userNotificationsCol(uid));
  const [page, unread] = await Promise.all([
    col.orderBy("createdAt", "desc").limit(Math.min(Math.max(limit, 1), 100)).get(),
    col.where("readAt", "==", null).count().get(),
  ]);
  const items = page.docs.map((d) => {
    const n = d.data() as NotificationDoc;
    return { id: d.id, title: n.title, body: n.body, url: n.url, read: n.readAt !== null, createdAt: n.createdAt?.toDate().toISOString() ?? new Date(0).toISOString() };
  });
  return { items, unreadCount: unread.data().count };
}

export async function markNotificationRead(db: Firestore, uid: string, id: string): Promise<void> {
  // Scoped by the caller's own uid in the path, so nobody can touch another user's notification.
  const ref = db.collection(userNotificationsCol(uid)).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotificationError(`No notification ${id}`);
  if ((snap.data() as NotificationDoc).readAt === null) await ref.update({ readAt: FieldValue.serverTimestamp() });
}

export async function markAllNotificationsRead(db: Firestore, uid: string): Promise<number> {
  const snap = await db.collection(userNotificationsCol(uid)).where("readAt", "==", null).limit(500).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  for (const d of snap.docs) batch.update(d.ref, { readAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return snap.size;
}

/** The email's first paragraph as plain text: tags dropped, the few entities esc() emits decoded. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
