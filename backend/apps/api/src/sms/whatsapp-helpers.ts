// Pure helpers for the WhatsApp Cloud API path. Separate from
// `whatsapp.ts` because that file holds the Nest-decorated class, and
// `--experimental-strip-types` (how every .check.ts runs) can't parse
// decorators. Keeping the helpers here lets the check script import
// just the logic without dragging in the Nest module graph.

/** Fallback-relevant categories the controller inspects. */
export type WhatsAppSendErrorCode =
  | "not_configured"
  | "invalid_recipient"
  | "rate_limited"
  | "template_rejected"
  | "upstream_error"
  | "timeout";

export class WhatsAppSendError extends Error {
  readonly code: WhatsAppSendErrorCode;
  readonly httpStatus: number | undefined;
  constructor(message: string, code: WhatsAppSendErrorCode, httpStatus?: number) {
    super(message);
    this.name = "WhatsAppSendError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Normalise an Indian mobile to Meta's "91XXXXXXXXXX" form (12 digits,
 *  no `+`). Accepts common user-typed shapes. */
export function normalisePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 13 && digits.startsWith("91")) return digits.slice(1);
  throw new WhatsAppSendError(
    "Invalid Indian mobile number for WhatsApp",
    "invalid_recipient",
  );
}

/** Map a Meta error response to our fallback-category code. */
export function categoriseWhatsAppFailure(
  httpStatus: number,
  metaCode: number | undefined,
): WhatsAppSendErrorCode {
  if (httpStatus === 429 || metaCode === 80007) return "rate_limited";
  if (metaCode === 132000 || metaCode === 132001 || metaCode === 132007)
    return "template_rejected";
  // 131026: Receiver incapable (not on WhatsApp). 131031: Account locked.
  // 131047: Re-engagement — 24h window. All mean "this recipient won't
  // get WhatsApp from us"; SMS fallback is the right call.
  if (metaCode === 131026 || metaCode === 131031 || metaCode === 131047)
    return "invalid_recipient";
  return "upstream_error";
}

/** Build Meta's authentication-template POST body. Both the body and
 *  button components carry the SAME code — Meta rejects mismatched
 *  codes with 132012. */
export function buildAuthTemplateBody(args: {
  to: string;
  templateName: string;
  code: string;
}) {
  return {
    messaging_product: "whatsapp",
    to: args.to,
    type: "template",
    template: {
      name: args.templateName,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: args.code }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: args.code }],
        },
      ],
    },
  };
}
