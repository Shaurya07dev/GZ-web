// Per-user notification preferences and FCM device-token registry.
// Audit §8. Lives next to notifications.ts (the in-app inbox) because the
// three channels (email / in-app / push) share the same opt-out model.
//
// Transactional events bypass these preferences — they are safety and
// account hygiene, not marketing. Only the opt-in categories check them.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  Collections,
  userFcmTokensCol,
  userProfileCol,
  type FcmTokenDoc,
  type NotificationPreferences,
  type ProfileDoc,
} from "./collections.ts";
import { DbError } from "./errors.ts";

export class NotificationPrefError extends DbError {}

/** Defaults — opted into every category. */
export const DEFAULT_NOTIFICATION_PREFS: Required<NotificationPreferences> = {
  abandonedCart: true,
  marketing: true,
  weeklyDigest: true,
  pushEnabled: true,
};

export async function readNotificationPreferences(
  db: Firestore,
  userId: string,
): Promise<Required<NotificationPreferences>> {
  const snap = await db.collection(userProfileCol(userId)).doc("data").get();
  const stored = (snap.data() as ProfileDoc | undefined)?.notificationPreferences;
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(stored ?? {}) };
}

export async function updateNotificationPreferences(
  db: Firestore,
  userId: string,
  patch: NotificationPreferences,
): Promise<Required<NotificationPreferences>> {
  const ref = db.collection(userProfileCol(userId)).doc("data");
  // Only write keys that were explicitly passed — a missing key keeps the
  // existing value rather than resetting to the default.
  const sanitized: Record<string, boolean> = {};
  for (const key of ["abandonedCart", "marketing", "weeklyDigest", "pushEnabled"] as const) {
    if (patch[key] !== undefined) sanitized[`notificationPreferences.${key}`] = patch[key] as boolean;
  }
  if (Object.keys(sanitized).length > 0) {
    await ref.set(sanitized as never, { merge: true });
  }
  return readNotificationPreferences(db, userId);
}

/** Registers (or refreshes the lastSeenAt of) a device token for push. */
export async function registerFcmToken(
  db: Firestore,
  userId: string,
  input: { token: string; platform: FcmTokenDoc["platform"]; deviceLabel: string | null },
): Promise<void> {
  if (!input.token || input.token.length < 20) {
    throw new NotificationPrefError("FCM token is empty or implausibly short");
  }
  const ref = db
    .collection(userFcmTokensCol(userId))
    .doc(input.token.slice(0, 1500));
  const existing = await ref.get();
  if (existing.exists) {
    await ref.update({ lastSeenAt: FieldValue.serverTimestamp() });
    return;
  }
  await ref.set({
    token: input.token,
    platform: input.platform,
    deviceLabel: input.deviceLabel,
    createdAt: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp(),
  });
}

export async function revokeFcmToken(
  db: Firestore,
  userId: string,
  token: string,
): Promise<void> {
  await db.collection(userFcmTokensCol(userId)).doc(token.slice(0, 1500)).delete();
}

export async function listFcmTokens(
  db: Firestore,
  userId: string,
): Promise<string[]> {
  const snap = await db.collection(userFcmTokensCol(userId)).get();
  return snap.docs.map((d) => (d.data() as FcmTokenDoc).token).filter(Boolean);
}

/**
 * Collects every token for every user whose email appears in `emails`, so a
 * `notify()` abstraction can fan out to the same recipients as a given mail.
 * Returns tokens keyed by uid so push failures can be attributed back when a
 * token is invalidated by FCM.
 */
export async function fcmTokensForEmails(
  db: Firestore,
  emails: string[],
): Promise<Map<string, string[]>> {
  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return new Map();
  const result = new Map<string, string[]>();
  for (let i = 0; i < normalized.length; i += 30) {
    const snap = await db
      .collection(Collections.users)
      .where("email", "in", normalized.slice(i, i + 30))
      .get();
    for (const d of snap.docs) {
      const tokens = await listFcmTokens(db, d.id);
      if (tokens.length > 0) result.set(d.id, tokens);
    }
  }
  return result;
}
