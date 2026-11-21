// WhatsApp Cloud API adapter for OTP delivery.
//
// Meta's authentication-category template we use is `galleryzone_login_otp`
// — one body variable `{{1}}` = the 6-digit code, plus a "Copy code"
// button wired to the same code. Template was approved on 20 Nov 2026
// on the +91 85230 41055 line (WABA "GalleryZone OTP").
//
// Four env vars gate this sender:
//   WHATSAPP_ACCESS_TOKEN          — permanent System-User token (never-
//                                    expires, scoped to whatsapp_business_
//                                    messaging + whatsapp_business_management)
//   WHATSAPP_PHONE_NUMBER_ID       — the Phone Number ID from WhatsApp Mgr
//   WHATSAPP_BUSINESS_ACCOUNT_ID   — WABA id (unused on the send path but
//                                    kept for the health check / template
//                                    status queries)
//   WHATSAPP_OTP_TEMPLATE_NAME     — `galleryzone_login_otp`
//
// Any one of the four missing → [enabled] is false and the controller
// answers 503 (misconfiguration — WhatsApp is the only OTP channel as
// of 21 Nov 2026). When the sender is enabled but Meta refuses a send,
// the controller catches it and returns a soft-fail response the
// client renders as "you can verify your phone later from your profile".

import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AppEnv } from "@galleryzone/config";
import { ENV } from "../db.module.ts";

/** Meta's Graph API base. We pin a specific version so a breaking change
 *  in a newer Graph version doesn't suddenly break our OTP path. Current
 *  major is v22.0 (Nov 2026); bump this after reading the Graph API
 *  changelog. */
const GRAPH_VERSION = "v22.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface SendWhatsAppOtpInput {
  /** 10-digit Indian mobile, with or without +91. Normalised internally. */
  phone: string;
  /** The 6-digit code to drop into the template's `{{1}}` variable AND
   *  the "Copy code" button payload. Must be the SAME code — Meta
   *  rejects the template call otherwise. */
  code: string;
}

// Pure logic (phone normalise, error categorisation, template body)
// lives in ./whatsapp-helpers.ts so the stability check can import it
// without pulling in this file's Nest decorators (which strip-only mode
// can't parse). Re-export here for backwards-compat with any existing
// import { WhatsAppSendError } from "./whatsapp.ts" call site.
export {
  WhatsAppSendError,
  normalisePhoneForWhatsApp,
  categoriseWhatsAppFailure,
  buildAuthTemplateBody,
  type WhatsAppSendErrorCode,
} from "./whatsapp-helpers.ts";
import {
  WhatsAppSendError,
  normalisePhoneForWhatsApp,
  categoriseWhatsAppFailure,
  buildAuthTemplateBody,
} from "./whatsapp-helpers.ts";

@Injectable()
export class WhatsAppSender {
  private readonly logger = new Logger(WhatsAppSender.name);
  private readonly accessToken: string | null;
  private readonly phoneNumberId: string | null;
  private readonly wabaId: string | null;
  private readonly templateName: string | null;

  constructor(@Inject(ENV) env: AppEnv) {
    this.accessToken = env.whatsapp?.accessToken ?? null;
    this.phoneNumberId = env.whatsapp?.phoneNumberId ?? null;
    this.wabaId = env.whatsapp?.businessAccountId ?? null;
    this.templateName = env.whatsapp?.otpTemplateName ?? null;
    if (!this.enabled) {
      this.logger.warn(
        "WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_BUSINESS_ACCOUNT_ID / WHATSAPP_OTP_TEMPLATE_NAME not all set — phone-OTP endpoint will answer 503 (WhatsApp is the only channel)",
      );
    }
  }

  get enabled(): boolean {
    return Boolean(
      this.accessToken && this.phoneNumberId && this.wabaId && this.templateName,
    );
  }

  /** WABA id. Exposed for the health endpoint — it does NOT appear on
   *  the send path. */
  get businessAccountId(): string | null {
    return this.wabaId;
  }

  /** Delegates to the free `normalisePhoneForWhatsApp` so the check
   *  script can test the normalisation directly without pulling in
   *  this Nest-decorated class (which `--experimental-strip-types`
   *  can't parse because of the decorator). */
  static normalisePhone = normalisePhoneForWhatsApp;

  /**
   * Sends the OTP via WhatsApp Cloud API. Throws WhatsAppSendError on
   * any failure — the caller catches it and responds to the client
   * with a soft-fail "verify later from profile" message. No retry at
   * this layer; the user can tap "Resend code" to try again.
   */
  async send(input: SendWhatsAppOtpInput): Promise<void> {
    if (
      !this.enabled ||
      !this.accessToken ||
      !this.phoneNumberId ||
      !this.templateName
    ) {
      throw new WhatsAppSendError("WhatsApp sender not configured", "not_configured");
    }
    const to = normalisePhoneForWhatsApp(input.phone);
    const body = buildAuthTemplateBody({
      to,
      templateName: this.templateName,
      code: input.code,
    });

    const url = `${GRAPH_BASE}/${this.phoneNumberId}/messages`;
    let res: Response;
    try {
      // 8s timeout — if Meta is slower than that we bail out and the
      // controller returns a soft-fail. 8s matches the user-perceived
      // "the code is taking forever" threshold.
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000),
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "TimeoutError";
      throw new WhatsAppSendError(
        isAbort ? "WhatsApp send timed out after 8s" : `WhatsApp network error: ${String(err)}`,
        isAbort ? "timeout" : "upstream_error",
      );
    }

    // Meta returns { messages: [{ id }] } on success. On error it returns
    // { error: { code, message, error_subcode, ... } }.
    const payload = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { code?: number; message?: string; error_subcode?: number; type?: string };
    };

    if (res.ok && Array.isArray(payload.messages) && payload.messages[0]?.id) {
      this.logger.log(
        JSON.stringify({
          event: "whatsapp.send.ok",
          messageId: payload.messages[0].id,
          // Only log last-5 of the recipient number.
          to: `***${to.slice(-5)}`,
        }),
      );
      return;
    }

    // Map Meta's error codes to fallback-relevant categories so the
    // controller can log structured telemetry.
    const metaCode = payload.error?.code;
    const metaSub = payload.error?.error_subcode;
    const kind = categoriseWhatsAppFailure(res.status, metaCode);

    this.logger.warn(
      JSON.stringify({
        event: "whatsapp.send.failed",
        status: res.status,
        metaCode,
        metaSub,
        kind,
        message: payload.error?.message,
        to: `***${to.slice(-5)}`,
      }),
    );

    throw new WhatsAppSendError(
      payload.error?.message ?? `WhatsApp send failed (HTTP ${res.status})`,
      kind,
      res.status,
    );
  }
}
