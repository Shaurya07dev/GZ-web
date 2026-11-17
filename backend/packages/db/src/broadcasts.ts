// Admin broadcasts: one message typed once, delivered to every artist, every aggregator, or both.
//
// Each recipient gets two things: a thread in their Messages inbox (the page that used to be empty:
// messageThreads, read by GET /v1/messages) and a bell notification that points at it. The broadcast itself
// is kept in `broadcasts` so the admin can see what was sent, to whom, and by whom.
//
// ponytail: the fan-out is one batch write per 200 recipients, run one after another, inside the request. Fine
// for hundreds or a few thousand accounts; move it to a background job if the audience ever grows past that.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { Collections, type BroadcastDoc, type MessageThreadDoc, type UserDoc } from "./collections.ts";
import { DbError } from "./errors.ts";
import { notificationIdFor, userNotificationsCol, type NotificationDoc } from "./notifications.ts";
import { adminNames } from "./reviews.ts";

export class BroadcastError extends DbError {}

export const broadcastAudiences = ["artist", "aggregator"] as const;
export type BroadcastAudience = (typeof broadcastAudiences)[number];

export const BROADCAST_TITLE_MAX = 80;
export const BROADCAST_BODY_MAX = 2000;

/** Which accounts a broadcast reaches: the chosen roles, minus suspended and blocked accounts. Pure. */
export function recipientsOf(users: { id: string; role: string; status: string }[], audiences: readonly string[]): string[] {
  return users.filter((u) => audiences.includes(u.role) && u.status !== "suspended" && u.status !== "blocked").map((u) => u.id);
}

/** The one-line preview the inbox shows before a message is opened. Pure. */
export function previewOf(body: string, max = 120): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1).trimEnd()}…`;
}

async function accountsIn(db: Firestore, audiences: readonly BroadcastAudience[]) {
  const snap = await db.collection(Collections.users).where("role", "in", [...audiences]).get();
  return snap.docs.map((d) => {
    const user = d.data() as UserDoc;
    return { id: d.id, role: user.role as string, status: user.status as string };
  });
}

/** How many people each audience would reach right now, for the "Reaches N" line while composing. */
export async function broadcastReach(db: Firestore): Promise<Record<BroadcastAudience, number>> {
  const accounts = await accountsIn(db, broadcastAudiences);
  return {
    artist: recipientsOf(accounts, ["artist"]).length,
    aggregator: recipientsOf(accounts, ["aggregator"]).length,
  };
}

export interface BroadcastInput {
  adminId: string;
  audiences: BroadcastAudience[];
  title: string;
  body: string;
  /** A path on the site the message points at ("/dashboard/coa-nfc"), or null. */
  url: string | null;
}

export async function sendBroadcast(db: Firestore, input: BroadcastInput): Promise<{ id: string; recipientCount: number }> {
  const title = input.title.trim();
  const body = input.body.trim();
  const audiences = [...new Set(input.audiences)];
  if (!title || title.length > BROADCAST_TITLE_MAX) throw new BroadcastError(`The title must be 1 to ${BROADCAST_TITLE_MAX} characters`);
  if (!body || body.length > BROADCAST_BODY_MAX) throw new BroadcastError(`The message must be 1 to ${BROADCAST_BODY_MAX} characters`);
  if (audiences.length === 0) throw new BroadcastError("Choose who should get the message");

  const accounts = await accountsIn(db, audiences);
  const uids = recipientsOf(accounts, audiences);
  if (uids.length === 0) throw new BroadcastError("Nobody is in that audience yet");

  const ref = db.collection(Collections.broadcasts).doc();
  const doc: BroadcastDoc = {
    title,
    body,
    audiences,
    url: input.url,
    sentBy: input.adminId,
    sentAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
    recipientCount: uids.length,
  };
  await ref.create(doc);

  const notificationKey = notificationIdFor(`broadcast/${ref.id}`);
  const preview = previewOf(body);
  const roleOf = new Map(accounts.map((a) => [a.id, a.role]));
  for (let i = 0; i < uids.length; i += 200) {
    const batch = db.batch();
    for (const uid of uids.slice(i, i + 200)) {
      const thread: Omit<MessageThreadDoc, "receivedAt"> & { receivedAt: FieldValue } = {
        userId: uid,
        fromLabel: "GalleryZone",
        subject: title,
        preview,
        body,
        unread: true,
        receivedAt: FieldValue.serverTimestamp(),
      };
      batch.create(db.collection(Collections.messageThreads).doc(`bc_${ref.id}_${uid}`), thread);
      const bell: Omit<NotificationDoc, "createdAt"> & { createdAt: FieldValue } = {
        title,
        body: preview,
        url: input.url ?? (roleOf.get(uid) === "aggregator" ? "/aggregator/messages" : "/dashboard/messages"),
        readAt: null,
        createdAt: FieldValue.serverTimestamp(),
      };
      batch.create(db.collection(userNotificationsCol(uid)).doc(notificationKey), bell);
    }
    await batch.commit();
  }

  await db.collection(Collections.auditLog).add({
    adminId: input.adminId,
    action: "broadcast.sent",
    entityType: "broadcast",
    entityId: ref.id,
    entityLabel: title,
    detail: { audiences, recipientCount: uids.length },
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, recipientCount: uids.length };
}

export interface BroadcastView {
  id: string;
  title: string;
  body: string;
  audiences: string[];
  url: string | null;
  sentByName: string;
  sentAt: string;
  recipientCount: number;
}

/** What has been sent, newest first. */
export async function listBroadcasts(db: Firestore, limit = 50): Promise<BroadcastView[]> {
  const snap = await db.collection(Collections.broadcasts).orderBy("sentAt", "desc").limit(Math.min(Math.max(limit, 1), 200)).get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as BroadcastDoc) }));
  const names = await adminNames(db, rows.map((r) => r.sentBy));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    audiences: r.audiences,
    url: r.url,
    sentByName: names.get(r.sentBy) ?? "An admin",
    sentAt: r.sentAt?.toDate().toISOString() ?? new Date(0).toISOString(),
    recipientCount: r.recipientCount,
  }));
}
