// Run: node --experimental-strip-types backend/apps/api/src/eway-bill/eway-bill.check.ts
//
// Pure-helper sanity: success/failure response parsing, redaction of
// secrets, snippet clamping, state-code lookup. The service class
// itself (eway-bill.ts) needs a real sandbox round-trip to exercise,
// which lives behind the EWAYBILL_* env vars.

import assert from "node:assert/strict";
import {
  clampSnippet,
  EWB_VALUE_THRESHOLD_PAISE,
  isNicSuccess,
  parseNicError,
  redactForAudit,
  RESPONSE_SNIPPET_MAX,
  stateNumericCode,
} from "./eway-bill-helpers.ts";

// --- Threshold -----------------------------------------------------------
assert.equal(EWB_VALUE_THRESHOLD_PAISE, 50_000_00, "threshold is Rs. 50,000 in paise");

// --- Success detection ---------------------------------------------------
assert.equal(isNicSuccess({ status_cd: "1" }), true, "status_cd='1' is success");
assert.equal(isNicSuccess({ status_cd: 1 }), true, "numeric 1 is also success");
assert.equal(isNicSuccess({ status_cd: "0" }), false, "status_cd='0' is failure");
assert.equal(isNicSuccess(null), false, "null body is not success");
assert.equal(isNicSuccess({}), false, "empty body is not success");

// --- Error parsing -------------------------------------------------------
const e1 = parseNicError({
  status_cd: "0",
  status_desc: "Invalid request",
  error: { error_cd: "333", message: "GSTIN is not registered" },
});
assert.equal(e1.code, "nic:333");
assert.equal(e1.message, "GSTIN is not registered");
assert.equal(e1.nicStatusCd, "0");

const e2 = parseNicError({ status_cd: "0", status_desc: "No error object" });
assert.equal(e2.code, "nic:status_0");
assert.equal(e2.message, "No error object");

const e3 = parseNicError("string body");
assert.equal(e3.code, "parse:not_object");

// --- Redaction -----------------------------------------------------------
const redacted = redactForAudit({
  totInvValue: 10000,
  client_id: "EWBS123",
  client_secret: "shhh",
  nested: { password: "p", keep: "ok" },
  itemList: [{ hsnCode: "9701", quantity: 1 }],
});
assert.equal(redacted.client_id, "[REDACTED]");
assert.equal(redacted.client_secret, "[REDACTED]");
assert.equal((redacted.nested as Record<string, unknown>).password, "[REDACTED]");
assert.equal((redacted.nested as Record<string, unknown>).keep, "ok");
assert.equal(redacted.totInvValue, 10000);

// --- State codes ---------------------------------------------------------
assert.equal(stateNumericCode("TS"), 36, "Telangana = 36");
assert.equal(stateNumericCode("ts"), 36, "case-insensitive");
assert.equal(stateNumericCode("KA"), 29, "Karnataka = 29");
assert.equal(stateNumericCode("DL"), 7, "Delhi = 7");
assert.equal(stateNumericCode("XX"), null, "unknown code returns null");

// --- Snippet clamping ----------------------------------------------------
assert.equal(clampSnippet("hi"), "hi", "short string unchanged");
const big = "x".repeat(RESPONSE_SNIPPET_MAX + 100);
const cut = clampSnippet(big);
assert.ok(cut.length <= RESPONSE_SNIPPET_MAX + 20, "big string is cut to cap + marker");
assert.ok(cut.endsWith("[truncated]"), "truncation marker is appended");

console.log(
  "apps/api/eway-bill: success/failure detection, NIC error parsing, secret redaction, state-code lookup, snippet clamp all OK",
);
