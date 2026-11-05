// Transactional email through Resend. One injectable; every product email is
// written in templates.ts and handed here by emails.ts.
//
// Rules: never let a mail failure fail the request that triggered it (the order
// still went through: log and move on); always pass an idempotency key, so a
// retried request or a repeated webhook can't double-send; answer as a no-op
// when RESEND_API_KEY is unset, so local dev works without an account. The
// Resend SDK returns { data, error } instead of throwing.
//
// Production settings (all environment variables, see backend/README.md):
//   RESEND_API_KEY   a sending-only key for the verified domain
//   EMAIL_FROM       "GalleryZone <hello@galleryzone.art>": an address on the verified domain
//   EMAIL_REPLY_TO   the monitored mailbox replies should reach. Several emails say
//                    "reply to this email", so without it a reply goes to EMAIL_FROM.

import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";

export interface OutgoingMail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** `<event>/<entity-id>`: the same key with the same content within 24h is not re-sent. */
  idempotencyKey: string;
  /** Overrides EMAIL_REPLY_TO, for the few emails that should be answered by someone else. */
  replyTo?: string | undefined;
  /** Which email this is, as a Resend tag, so the dashboard can be filtered by it. */
  tag?: string | undefined;
}

const SANDBOX_SENDER = /@resend\.dev>?$/i;
const MAX_ATTEMPTS = 3;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Resend tags may hold only letters, numbers, underscores and dashes. */
const tagValue = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);

/** Idempotency keys can hold an address (password resets); logs should not. */
const logLabel = (key: string): string => (key.startsWith("password-reset/") ? "password-reset" : key);

@Injectable()
export class Mailer {
  private readonly logger = new Logger(Mailer.name);
  private readonly client: Resend | null;
  private readonly from: string;
  private readonly replyTo: string | undefined;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    this.client = key ? new Resend(key) : null;
    this.from = process.env.EMAIL_FROM || "GalleryZone <onboarding@resend.dev>";
    this.replyTo = process.env.EMAIL_REPLY_TO || undefined;
    this.checkSetup();
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /**
   * True once the Mailer can actually deliver to a stranger — key set AND
   * EMAIL_FROM not the Resend sandbox sender (which only reaches the
   * Resend account owner). OTP endpoints check this before issuing a
   * code; a false here means a signup silently stalls because the user
   * never gets their code.
   */
  get canDeliverExternally(): boolean {
    return this.client !== null && !SANDBOX_SENDER.test(this.from);
  }

  /** The reason canDeliverExternally is false — used in error responses. */
  get setupHint(): string | null {
    if (!this.client) return "RESEND_API_KEY is not set on the backend.";
    if (SANDBOX_SENDER.test(this.from)) {
      return "EMAIL_FROM is still the Resend sandbox sender (onboarding@resend.dev). Set it to an address on a domain you've verified in Resend (e.g. 'GalleryZone <hello@galleryzone.art>').";
    }
    return null;
  }

  /** Says at boot, in the logs, what would otherwise only show up as customers not getting email. */
  private checkSetup(): void {
    const production = process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT);
    if (!this.client) {
      this.logger.warn("RESEND_API_KEY not set: emails are logged, not sent");
      return;
    }
    if (SANDBOX_SENDER.test(this.from)) {
      const message = `EMAIL_FROM is "${this.from}", Resend's test sender, which only delivers to the Resend account's own address. Set EMAIL_FROM to an address on the verified domain.`;
      if (production) this.logger.error(message);
      else this.logger.warn(message);
    }
    if (production && !this.replyTo) {
      this.logger.warn("EMAIL_REPLY_TO is not set: replies to our emails go to the From address. Set it to a monitored support mailbox.");
    }
  }

  /** Fire-and-forget: resolves to the Resend message id, or null when not sent. Never throws. */
  async send(mail: OutgoingMail): Promise<string | null> {
    const to = Array.isArray(mail.to) ? mail.to : [mail.to];
    const label = logLabel(mail.idempotencyKey);
    if (!this.client) {
      this.logger.log(`[dry-run] to=${logLabel(mail.idempotencyKey) === "password-reset" ? "(hidden)" : to.join(",")} subject="${mail.subject}" key=${label}`);
      return null;
    }
    const replyTo = mail.replyTo ?? this.replyTo;
    const payload = {
      from: this.from,
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(replyTo ? { replyTo } : {}),
      ...(mail.tag ? { tags: [{ name: "email", value: tagValue(mail.tag) }] } : {}),
    };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { data, error, headers } = await this.client.emails.send(payload, { idempotencyKey: mail.idempotencyKey.slice(0, 256) });
        if (!error) return data?.id ?? null;

        const retryAfter = Number(headers?.["retry-after"]);
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 500 * 2 ** attempt;
        // Worth another go: the gateway asked us to slow down, it had a bad moment, or the same key is still in flight.
        const transient = error.name === "rate_limit_exceeded" || error.name === "concurrent_idempotent_requests" || (error.statusCode !== null && error.statusCode >= 500);
        if (transient && attempt < MAX_ATTEMPTS) {
          this.logger.warn(`send (${label}) ${error.name}, retrying in ${wait}ms (attempt ${attempt} of ${MAX_ATTEMPTS})`);
          await sleep(wait);
          continue;
        }
        this.logger.error(`send failed (${label}): ${error.name} ${error.message}${this.hint(error.name)}`);
        return null;
      } catch (error) {
        // A network error before any answer. The idempotency key makes the retry safe.
        if (attempt < MAX_ATTEMPTS) {
          this.logger.warn(`send (${label}) threw, retrying (attempt ${attempt} of ${MAX_ATTEMPTS}): ${String(error)}`);
          await sleep(500 * 2 ** attempt);
          continue;
        }
        this.logger.error(`send threw (${label}): ${String(error)}`);
        return null;
      }
    }
    return null;
  }

  /** What to do about the failures that are settings, not bugs. */
  private hint(name: string): string {
    switch (name) {
      case "daily_quota_exceeded":
      case "monthly_quota_exceeded":
        return ". The Resend plan's sending limit is used up: move to a paid plan, or wait for the limit to reset.";
      case "validation_error":
        return ". Check EMAIL_FROM is an address on a domain verified in Resend.";
      case "invalid_idempotent_request":
        return ". The same key was reused with different content: the caller needs a key that changes with the content.";
      case "restricted_api_key":
      case "invalid_api_key":
      case "missing_api_key":
        return ". Check RESEND_API_KEY.";
      default:
        return "";
    }
  }
}
