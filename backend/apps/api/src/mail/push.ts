// Push notifications via Firebase Cloud Messaging — audit §8.
//
// Thin wrapper around firebase-admin/messaging. Scoped to transactional +
// opt-in categories; honours the user's notificationPreferences.pushEnabled
// flag before sending.
//
// Rules:
//   - never throws into the caller (same contract as Mailer.send),
//   - uses sendEachForMulticast so one dead token can't block the rest,
//   - prunes tokens that FCM reports as unregistered or invalid.

import { Injectable, Logger } from "@nestjs/common";
import { getMessaging } from "firebase-admin/messaging";
import type { Firestore } from "firebase-admin/firestore";
import {
  Collections,
  fcmTokensForEmails,
  readNotificationPreferences,
  revokeFcmToken,
  type UserDoc,
} from "@galleryzone/db";

export interface PushPayload {
  title: string;
  body: string;
  /** Optional deep-link path, e.g. "/account/orders/abc". The client is
   *  responsible for routing. */
  url?: string | null;
}

@Injectable()
export class PushSender {
  private readonly logger = new Logger(PushSender.name);
  private available = true;

  /**
   * Push to every registered device of every user behind these emails.
   * Mirrors the mailer: silent no-op without credentials, swallows errors
   * so a transactional flow never fails on a push failure.
   */
  async sendToEmails(db: Firestore, emails: string[], payload: PushPayload): Promise<number> {
    if (!this.available) return 0;
    const tokensByUser = await fcmTokensForEmails(db, emails);
    if (tokensByUser.size === 0) return 0;

    // Honour per-user pushEnabled opt-out.
    const sendable = new Map<string, string[]>();
    for (const [uid, tokens] of tokensByUser) {
      const prefs = await readNotificationPreferences(db, uid).catch(() => null);
      if (prefs === null || prefs.pushEnabled) sendable.set(uid, tokens);
    }
    if (sendable.size === 0) return 0;

    let sent = 0;
    for (const [uid, tokens] of sendable) {
      sent += await this.sendTokens(db, uid, tokens, payload);
    }
    return sent;
  }

  /** Direct send to one user by uid. */
  async sendToUser(db: Firestore, uid: string, payload: PushPayload): Promise<number> {
    if (!this.available) return 0;
    const user = (await db.collection(Collections.users).doc(uid).get()).data() as
      | UserDoc
      | undefined;
    if (!user?.email) return 0;
    return this.sendToEmails(db, [user.email], payload);
  }

  private async sendTokens(
    db: Firestore,
    uid: string,
    tokens: string[],
    payload: PushPayload,
  ): Promise<number> {
    try {
      const res = await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title: payload.title.slice(0, 100), body: payload.body.slice(0, 240) },
        ...(payload.url ? { data: { url: payload.url.slice(0, 500) } } : {}),
      });
      // Prune invalidated tokens — FCM returns per-token errors.
      for (let i = 0; i < res.responses.length; i++) {
        const r = res.responses[i]!;
        if (r.success) continue;
        const code = r.error?.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument"
        ) {
          await revokeFcmToken(db, uid, tokens[i]!).catch(() => {});
        }
      }
      return res.successCount;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // No app configured yet is a dev-mode condition, not an error. After
      // the first warning we stop logging it on every send.
      if (/default FirebaseApp|No Firebase app/.test(message)) {
        if (this.available) this.logger.warn(`push disabled: ${message}`);
        this.available = false;
        return 0;
      }
      this.logger.error(`push send failed: ${message}`);
      return 0;
    }
  }
}
