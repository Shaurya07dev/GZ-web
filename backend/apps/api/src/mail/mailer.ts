// Transactional email through Resend. One injectable; every product email
// is a function in emails.ts that renders a template and calls send().
//
// Rules: never let a mail failure fail the request that triggered it (the
// order still went through; log and move on), always pass an idempotency
// key so a retried request can't double-send, and answer as a no-op when
// RESEND_API_KEY is unset so local dev works without an account. The
// Resend SDK returns { data, error } instead of throwing.

import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";

export interface OutgoingMail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** `<event>/<entity-id>` — same key + same payload within 24h is not re-sent. */
  idempotencyKey: string;
  replyTo?: string | undefined;
}

@Injectable()
export class Mailer {
  private readonly logger = new Logger(Mailer.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    this.client = key ? new Resend(key) : null;
    this.from = process.env.EMAIL_FROM || "GalleryZone <onboarding@resend.dev>";
    if (!this.client) this.logger.warn("RESEND_API_KEY not set — emails are logged, not sent");
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /** Fire-and-forget: resolves to the Resend message id, or null when not sent. Never throws. */
  async send(mail: OutgoingMail): Promise<string | null> {
    const to = Array.isArray(mail.to) ? mail.to : [mail.to];
    if (!this.client) {
      this.logger.log(`[dry-run] to=${to.join(",")} subject="${mail.subject}" key=${mail.idempotencyKey}`);
      return null;
    }
    try {
      const { data, error } = await this.client.emails.send(
        { from: this.from, to, subject: mail.subject, html: mail.html, text: mail.text, ...(mail.replyTo ? { replyTo: mail.replyTo } : {}) },
        { idempotencyKey: mail.idempotencyKey.slice(0, 256) },
      );
      if (error) {
        this.logger.error(`send failed (${mail.idempotencyKey}): ${error.name} ${error.message}`);
        return null;
      }
      return data?.id ?? null;
    } catch (error) {
      this.logger.error(`send threw (${mail.idempotencyKey}): ${String(error)}`);
      return null;
    }
  }
}
