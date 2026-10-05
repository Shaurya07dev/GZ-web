// The two Razorpay signatures, as pure functions.
//
// Both are HMAC-SHA256-hex, both are the only thing standing between a forged
// request and a settled order, and they differ in three ways that are easy to
// mix up — which is exactly why they live here, in one file, with a check:
//
//                     | signed over                  | with
//   ------------------|------------------------------|-------------------
//   checkout callback | "<order_id>|<payment_id>"    | the API key secret
//   webhook           | the RAW request body bytes   | the WEBHOOK secret
//
// Getting the secret wrong is the common mistake, because Cashfree (which this
// codebase used for one day) signs webhooks with its API secret and has no
// separate webhook secret at all. Razorpay has three credentials, not two.
//
// Both comparisons are constant-time. A length-dependent early return is
// unavoidable (and harmless — the length of a hex digest is not a secret), but
// the contents are never compared byte-by-byte with a short circuit.

import { createHmac, timingSafeEqual } from "node:crypto";

/** Constant-time string compare. False for a length mismatch, without timing the contents. */
export function signaturesMatch(expected: string, provided: string | undefined): boolean {
  if (!provided) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * What Checkout.js hands the browser:
 * `HMAC_SHA256("<razorpay_order_id>|<razorpay_payment_id>", keySecret)`, hex.
 *
 * Signed with the **API key secret**, not the webhook secret.
 */
export function razorpayCheckoutSignature(input: { razorpayOrderId: string; razorpayPaymentId: string; keySecret: string }): string {
  return createHmac("sha256", input.keySecret).update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`).digest("hex");
}

/**
 * What Razorpay puts in `x-razorpay-signature`:
 * `HMAC_SHA256(rawBody, webhookSecret)`, hex.
 *
 * The RAW bytes, not re-serialised JSON — key order, whitespace and unicode
 * escaping all change the digest, so a round trip through JSON.parse and
 * JSON.stringify silently breaks every webhook.
 *
 * Signed with the **webhook secret** chosen in the dashboard, which is a third
 * credential distinct from the API key secret.
 */
export function razorpayWebhookSignature(rawBody: Buffer | string, webhookSecret: string): string {
  return createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
}
