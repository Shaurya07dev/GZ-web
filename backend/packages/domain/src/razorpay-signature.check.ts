// Pins both Razorpay signatures against independently computed digests.
//
// These two HMACs are what stand between a forged request and a settled order,
// so each property below is one way the money could have moved wrongly:
// the wrong secret, a re-serialised body, a truncated digest comparison, or a
// payload whose parts can be shuffled without changing the signature.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { razorpayCheckoutSignature, razorpayWebhookSignature, signaturesMatch } from "./razorpay-signature.ts";

const KEY_SECRET = "api_key_secret_do_not_use";
const WEBHOOK_SECRET = "webhook_secret_do_not_use";
const hmac = (data: Buffer | string, secret: string) => createHmac("sha256", secret).update(data).digest("hex");

// ---- the checkout callback ------------------------------------------------

const ORDER = "order_PkL9mNbVcXz1Qw";
const PAYMENT = "pay_PkL9mNbVcXz2Er";

const callback = razorpayCheckoutSignature({ razorpayOrderId: ORDER, razorpayPaymentId: PAYMENT, keySecret: KEY_SECRET });
// The documented construction, computed here independently: order|payment.
assert.equal(callback, hmac(`${ORDER}|${PAYMENT}`, KEY_SECRET));
assert.match(callback, /^[0-9a-f]{64}$/);

// The separator is load-bearing. Without it, an attacker who can influence
// either id could shift the boundary between them and reuse a signature for a
// different pair.
assert.notEqual(callback, hmac(`${ORDER}${PAYMENT}`, KEY_SECRET));

// Changing either id changes the signature.
assert.notEqual(callback, razorpayCheckoutSignature({ razorpayOrderId: ORDER, razorpayPaymentId: `${PAYMENT}x`, keySecret: KEY_SECRET }));
assert.notEqual(callback, razorpayCheckoutSignature({ razorpayOrderId: `${ORDER}x`, razorpayPaymentId: PAYMENT, keySecret: KEY_SECRET }));

// Signed with the API key secret, NOT the webhook secret. This is the mistake
// the Cashfree detour makes tempting: Cashfree has no separate webhook secret.
assert.notEqual(callback, razorpayCheckoutSignature({ razorpayOrderId: ORDER, razorpayPaymentId: PAYMENT, keySecret: WEBHOOK_SECRET }));

// ---- the webhook ----------------------------------------------------------

// Deliberately awkward, and the awkwardness is the point: insignificant
// whitespace and non-ASCII. JSON.parse discards the whitespace, so a body
// re-serialised from the parsed object is a DIFFERENT byte string with a
// different digest — even though it is the same JSON document.
const RAW =
  '{\n  "event": "payment.captured",\n  "payload": { "payment": { "entity": {\n    "notes": { "gzOrderId": "abc" },\n    "amount": 2010020,\n    "method": "upi",\n    "label": "Untitled — कला"\n  } } }\n}';

const webhook = razorpayWebhookSignature(RAW, WEBHOOK_SECRET);
assert.equal(webhook, hmac(RAW, WEBHOOK_SECRET));
assert.match(webhook, /^[0-9a-f]{64}$/);

// The RAW bytes, not a re-serialised body. A round trip through parse and
// stringify changes the digest, which is why the controller takes req.rawBody.
const reserialised = JSON.stringify(JSON.parse(RAW));
assert.notEqual(reserialised, RAW, "the fixture must actually differ once re-serialised");
assert.notEqual(webhook, razorpayWebhookSignature(reserialised, WEBHOOK_SECRET));

// A Buffer and the equivalent string agree, since express may hand over either.
assert.equal(razorpayWebhookSignature(Buffer.from(RAW, "utf8"), WEBHOOK_SECRET), webhook);

// Signed with the webhook secret, NOT the API key secret.
assert.notEqual(webhook, razorpayWebhookSignature(RAW, KEY_SECRET));

// A single flipped byte anywhere in the body changes it.
assert.notEqual(webhook, razorpayWebhookSignature(RAW.replace("2010020", "2010021"), WEBHOOK_SECRET));
// Including in a field we read to decide WHICH order settles.
assert.notEqual(webhook, razorpayWebhookSignature(RAW.replace('"gzOrderId": "abc"', '"gzOrderId": "xyz"'), WEBHOOK_SECRET));

// ---- the comparison -------------------------------------------------------

assert.equal(signaturesMatch(webhook, webhook), true);
assert.equal(signaturesMatch(webhook, undefined), false);
assert.equal(signaturesMatch(webhook, ""), false);
// A prefix must NOT pass. If the comparison ever truncated, this is the test
// that fails — a forger who can produce a matching first byte would otherwise
// be able to walk the digest.
assert.equal(signaturesMatch(webhook, webhook.slice(0, 32)), false);
assert.equal(signaturesMatch(webhook, `${webhook}00`), false);
// Hex case is not normalised: Razorpay sends lowercase, and silently accepting
// uppercase would mean accepting a digest we did not compute.
assert.equal(signaturesMatch(webhook, webhook.toUpperCase()), false);
// One differing character fails.
const flipped = `${webhook.slice(0, 63)}${webhook.at(-1) === "a" ? "b" : "a"}`;
assert.equal(signaturesMatch(webhook, flipped), false);

console.log("packages/domain/razorpay-signature.ts: callback (order|payment, API secret) and webhook (raw body, webhook secret) HMACs pinned, comparison rejects prefixes");
