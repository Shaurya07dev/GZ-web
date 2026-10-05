// Shared gate for the two Cashfree webhooks (payments and Secure ID).
//
// Three outcomes, and the distinction between the last two is the point:
//
//   verified   — signature matches: process the event.
//   probe      — NO signature headers at all: acknowledge with 200 and process
//                NOTHING. This is what Cashfree's dashboard "Test & Add"
//                button sends, and refusing it makes a webhook impossible to
//                register. It costs nothing to allow, because an unsigned
//                request carries no data we are willing to act on, so a 200
//                here changes no state and reveals nothing.
//   rejected   — headers present but the signature does not match: 400. That
//                is not a probe, it is a forgery attempt or a key mismatch,
//                and it must be loud.
//
// The security property is "never act on unverified data", and all three
// outcomes keep it. What changes is only whether we answer 200 or 400 to a
// request we are ignoring either way.

import { BadRequestException, Logger } from "@nestjs/common";

export type WebhookCheck = "verified" | "probe" | "rejected";

const logger = new Logger("CashfreeWebhook");

export function classifyWebhook(input: {
  /** Which endpoint, for the log line. */
  source: string;
  rawBody: Buffer | string;
  timestamp: string | undefined;
  signature: string | undefined;
  verify: (rawBody: Buffer | string, timestamp: string | undefined, signature: string | undefined) => boolean;
}): WebhookCheck {
  const hasSignature = Boolean(input.signature);
  const hasTimestamp = Boolean(input.timestamp);

  if (!hasSignature && !hasTimestamp) {
    logger.warn(`${input.source}: unsigned probe acknowledged and ignored (no x-webhook-signature/timestamp)`);
    return "probe";
  }
  if (input.verify(input.rawBody, input.timestamp, input.signature)) return "verified";

  // Say which half was missing or wrong without logging the signature itself:
  // a half-present pair is almost always the wrong secret or a proxy stripping
  // a header, and that is exactly what someone debugging needs to know.
  const bodyLength = typeof input.rawBody === "string" ? input.rawBody.length : input.rawBody.byteLength;
  logger.error(
    `${input.source}: signature rejected (signature ${hasSignature ? "present" : "MISSING"}, timestamp ${hasTimestamp ? "present" : "MISSING"}, body ${bodyLength} bytes)`,
  );
  return "rejected";
}

export function invalidSignature(): BadRequestException {
  return new BadRequestException({ type: "about:blank", title: "Invalid webhook signature", status: 400, code: "bad_signature" });
}
