// WhatsApp sender stability check — tests the pure helpers used by the
// Nest-decorated `WhatsAppSender` class. We can't import the class
// itself here because `--experimental-strip-types` (how every check
// script runs) refuses to parse decorators. The class is a thin wrapper
// around the helpers tested below, so this covers all the risky logic.
//
// Run from `backend/`:
//   node --experimental-strip-types apps/api/src/sms/whatsapp.check.ts

import assert from "node:assert/strict";
import {
  WhatsAppSendError,
  buildAuthTemplateBody,
  categoriseWhatsAppFailure,
  normalisePhoneForWhatsApp,
} from "./whatsapp-helpers.ts";

// --- 1. Phone normalisation --------------------------------------------
assert.equal(normalisePhoneForWhatsApp("8523041055"), "918523041055");
assert.equal(normalisePhoneForWhatsApp("+91 85230 41055"), "918523041055");
assert.equal(normalisePhoneForWhatsApp("91-85230-41055"), "918523041055");
assert.equal(normalisePhoneForWhatsApp("+918523041055"), "918523041055");
assert.throws(
  () => normalisePhoneForWhatsApp("+1-415-555-1234"),
  (err: Error) =>
    err instanceof WhatsAppSendError &&
    (err as WhatsAppSendError).code === "invalid_recipient",
);
assert.throws(
  () => normalisePhoneForWhatsApp("1234"),
  (err: Error) =>
    err instanceof WhatsAppSendError &&
    (err as WhatsAppSendError).code === "invalid_recipient",
);

// --- 2. Error categorisation -------------------------------------------
// HTTP 429 → rate_limited regardless of body
assert.equal(categoriseWhatsAppFailure(429, undefined), "rate_limited");
// Meta code 80007 is their rate-limit marker even on 200
assert.equal(categoriseWhatsAppFailure(200, 80007), "rate_limited");
// Template rejections
assert.equal(categoriseWhatsAppFailure(400, 132000), "template_rejected");
assert.equal(categoriseWhatsAppFailure(400, 132001), "template_rejected");
assert.equal(categoriseWhatsAppFailure(400, 132007), "template_rejected");
// Recipient can't receive → fallback to SMS
assert.equal(categoriseWhatsAppFailure(400, 131026), "invalid_recipient");
assert.equal(categoriseWhatsAppFailure(400, 131031), "invalid_recipient");
assert.equal(categoriseWhatsAppFailure(400, 131047), "invalid_recipient");
// 5xx → upstream_error
assert.equal(categoriseWhatsAppFailure(500, undefined), "upstream_error");
assert.equal(categoriseWhatsAppFailure(503, 1), "upstream_error");
// Unknown 4xx → upstream_error (will fall back to SMS)
assert.equal(categoriseWhatsAppFailure(400, 999999), "upstream_error");

// --- 3. Template body shape --------------------------------------------
// Meta's authentication template needs the body and the button to carry
// the SAME code. Verify both components exist with the code.
{
  const body = buildAuthTemplateBody({
    to: "918523041055",
    templateName: "galleryzone_login_otp",
    code: "123456",
  });
  assert.equal(body.messaging_product, "whatsapp");
  assert.equal(body.to, "918523041055");
  assert.equal(body.type, "template");
  assert.equal(body.template.name, "galleryzone_login_otp");
  assert.equal(body.template.language.code, "en");
  assert.equal(body.template.components.length, 2);
  const [bodyComp, buttonComp] = body.template.components;
  assert.equal(bodyComp?.type, "body");
  assert.equal(bodyComp?.parameters?.[0]?.text, "123456");
  assert.equal(buttonComp?.type, "button");
  assert.equal(buttonComp?.sub_type, "url");
  assert.equal(buttonComp?.index, "0");
  assert.equal(buttonComp?.parameters?.[0]?.text, "123456");
}

// --- 4. WhatsAppSendError carries code + optional httpStatus -----------
{
  const err = new WhatsAppSendError("boom", "template_rejected", 400);
  assert.equal(err.name, "WhatsAppSendError");
  assert.equal(err.code, "template_rejected");
  assert.equal(err.httpStatus, 400);
  assert.equal(err.message, "boom");
}
{
  const err = new WhatsAppSendError("no token", "not_configured");
  assert.equal(err.code, "not_configured");
  assert.equal(err.httpStatus, undefined);
}

console.log(
  "apps/api/sms/whatsapp.ts: phone normalisation, error categorisation, template body shape + WhatsAppSendError all behave correctly",
);
