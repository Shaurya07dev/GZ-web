// MSG91 SMS adapter. One job: send a 6-digit OTP to an Indian phone number
// through MSG91's DLT-approved template.
//
// Owner directive 3 Nov 2026: SMS is MSG91 only. India's TRAI requires every
// transactional SMS to use a DLT-approved template + sender header, so the
// three env vars (AUTH_KEY, TEMPLATE_ID, SENDER_ID) are the three things
// MSG91 hands you after approval. Absent any of them, [enabled] is false
// and `send` throws — the controller translates that into a 503 so a
// sign-up never thinks the SMS went out when it didn't.
//
// MSG91's flow API accepts the template id (bound at account level to the
// sender id + exact message text) and a single list of { mobile, OTP }
// variable pairs. The OTP code is what we generate in db/otp.ts; this file
// just drives the HTTP call.

import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { AppEnv } from "@galleryzone/config";
import { ENV } from "../db.module.ts";

/** MSG91 Flow API — their current recommended endpoint for OTP delivery. */
const BASE_URL = "https://control.msg91.com/api/v5/flow";

export interface SendOtpSmsInput {
  /** 10-digit Indian mobile, with or without +91. [Msg91Sender.send] normalises. */
  phone: string;
  /** The 6-digit code to drop into the template's `##OTP##` variable. */
  code: string;
}

/**
 * Thin wrapper the auth controller depends on. The underlying client is
 * instantiated once; without MSG91 env it's a stub that refuses to send
 * (503), which the controller surfaces to the browser.
 */
@Injectable()
export class Msg91Sender {
  private readonly logger = new Logger(Msg91Sender.name);
  private readonly authKey: string | null;
  private readonly templateId: string | null;
  private readonly senderId: string | null;

  constructor(@Inject(ENV) env: AppEnv) {
    this.authKey = env.msg91?.authKey ?? null;
    this.templateId = env.msg91?.templateId ?? null;
    this.senderId = env.msg91?.senderId ?? null;
    if (!this.enabled) {
      this.logger.warn(
        "MSG91_AUTH_KEY / MSG91_TEMPLATE_ID / MSG91_SENDER_ID not set — phone OTP routes will answer 503",
      );
    }
  }

  get enabled(): boolean {
    return Boolean(this.authKey && this.templateId && this.senderId);
  }

  /**
   * Normalises an Indian mobile to the `91XXXXXXXXXX` form MSG91 expects
   * (12 digits, no `+`). Accepts common user-typed shapes.
   */
  static normalisePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return digits;
    if (digits.length === 13 && digits.startsWith("91")) return digits.slice(1);
    throw new ServiceUnavailableException({
      type: "about:blank",
      title: "That doesn't look like a valid Indian mobile number.",
      status: 400,
      code: "invalid_phone",
    });
  }

  async send(input: SendOtpSmsInput): Promise<void> {
    if (!this.enabled || !this.authKey || !this.templateId || !this.senderId) {
      throw new ServiceUnavailableException({
        type: "about:blank",
        title: "SMS is not configured on this server",
        status: 503,
        code: "sms_unavailable",
      });
    }
    const mobiles = Msg91Sender.normalisePhone(input.phone);
    // MSG91 Flow API body shape per their current docs
    // (https://docs.msg91.com/api-reference/sms/flow-api). The template_id
    // is bound to the sender + exact message content on their side; the
    // only variable we fill is OTP.
    const body = {
      template_id: this.templateId,
      sender: this.senderId,
      short_url: 0,
      recipients: [
        {
          mobiles,
          OTP: input.code,
        },
      ],
    };
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        authkey: this.authKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    // MSG91's response is `{ type: "success", message: "..." }` on OK; on
    // rejection the `type` is "error" even with HTTP 200, so both have to
    // be checked. A real HTTP failure (5xx, network) is a provider outage
    // — the controller catches 503 and tells the user to try again.
    const payload = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
    if (!res.ok || payload.type !== "success") {
      this.logger.error(
        JSON.stringify({
          event: "msg91.send.failed",
          status: res.status,
          type: payload.type,
          message: payload.message,
          phone: mobiles.slice(0, 5) + "…", // never log the full number
        }),
      );
      throw new ServiceUnavailableException({
        type: "about:blank",
        title: "We couldn't send the SMS. Please try again in a minute.",
        status: 503,
        code: "sms_send_failed",
      });
    }
  }
}
