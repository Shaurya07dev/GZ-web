// PAYMENTS_MODE decides whether a customer may mark their own order paid
// without paying, so the permissive value must never be reachable by accident.
// This check exists because it very nearly was: renaming the gateway left a
// stale provider name in the environment, and a lenient parse turned that
// stale value into "simulated" — free checkout.
//
// The gateway has now moved twice (Razorpay → Cashfree → back to Razorpay,
// client decision 5 Oct 2026), which is the whole argument for this file: each
// move leaves a value behind in some environment, and every one of them has to
// fail the boot rather than quietly open the door.

import assert from "node:assert/strict";
import { loadEnv } from "./env.ts";

// The required variables, so loadEnv gets far enough to reach PAYMENTS_MODE.
const base = { FIREBASE_PROJECT_ID: "p", GCP_PROJECT_ID: "p" } as const;
const load = (extra: Record<string, string | undefined>) => loadEnv({ ...base, ...extra } as NodeJS.ProcessEnv);

// The two deliberate values are accepted.
assert.equal(load({ PAYMENTS_MODE: "simulated" }).paymentsMode, "simulated");
assert.equal(load({ PAYMENTS_MODE: "razorpay" }).paymentsMode, "razorpay");

// The stale value this revision was written for: Cashfree was the gateway for
// one day. It must throw, and the message must point at the move rather than
// just saying "invalid".
assert.throws(() => load({ PAYMENTS_MODE: "cashfree" }), /moved back to Razorpay|not a valid mode/s);

// Anything else unrecognised throws too — no truthy-string shortcuts.
for (const bad of ["true", "1", "live", "production", "Razorpay", "RAZORPAY", "simulated ", "razorpayx"]) {
  assert.throws(() => load({ PAYMENTS_MODE: bad }), Error, `PAYMENTS_MODE=${bad} should be refused`);
}

// Unset: still "simulated" for local development...
assert.equal(load({}).paymentsMode, "simulated");
assert.equal(load({ NODE_ENV: "development" }).paymentsMode, "simulated");
assert.equal(load({ PAYMENTS_MODE: "" }).paymentsMode, "simulated");
// ...but never silently in production, where omitting it is never intentional.
assert.throws(() => load({ NODE_ENV: "production" }), /PAYMENTS_MODE is not set/);
assert.throws(() => load({ NODE_ENV: "production", PAYMENTS_MODE: "" }), /PAYMENTS_MODE is not set/);
// An explicit choice in production is honoured, including the permissive one.
assert.equal(load({ NODE_ENV: "production", PAYMENTS_MODE: "razorpay" }).paymentsMode, "razorpay");
assert.equal(load({ NODE_ENV: "production", PAYMENTS_MODE: "simulated" }).paymentsMode, "simulated");

// Cashfree's own environment is the other switch that must not drift open. It
// now only selects the Secure ID base URL, but a verification call landing on
// production credentials by accident is still the wrong kind of surprise.
assert.equal(load({}).cashfreeEnv, "sandbox");
assert.equal(load({ CASHFREE_ENV: "production" }).cashfreeEnv, "production");
assert.equal(load({ CASHFREE_ENV: "PRODUCTION" }).cashfreeEnv, "production");
assert.equal(load({ CASHFREE_ENV: "sandbox" }).cashfreeEnv, "sandbox");
assert.equal(load({ CASHFREE_ENV: "prod" }).cashfreeEnv, "sandbox");
assert.equal(load({ CASHFREE_ENV: "live" }).cashfreeEnv, "sandbox");

// The Secure ID 2FA public key. Unset means "use IP allow-listing" and must
// stay null rather than becoming an empty string, because the adapter decides
// whether to send X-Cf-Signature at all on exactly this value.
const PEM = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBg\n-----END PUBLIC KEY-----";
assert.equal(load({}).cashfreeVerificationPublicKey, null);
assert.equal(load({ CASHFREE_VERIFICATION_PUBLIC_KEY: "" }).cashfreeVerificationPublicKey, null);
assert.equal(load({ CASHFREE_VERIFICATION_PUBLIC_KEY: "   " }).cashfreeVerificationPublicKey, null);
// A real PEM passes through unchanged.
assert.equal(load({ CASHFREE_VERIFICATION_PUBLIC_KEY: PEM }).cashfreeVerificationPublicKey, PEM);
// Flattened newlines are restored, so a key pasted into a single-line env box works.
assert.equal(load({ CASHFREE_VERIFICATION_PUBLIC_KEY: PEM.replace(/\n/g, "\\n") }).cashfreeVerificationPublicKey, PEM);
// Base64 of the whole file is accepted and decoded.
assert.equal(load({ CASHFREE_VERIFICATION_PUBLIC_KEY: Buffer.from(PEM).toString("base64") }).cashfreeVerificationPublicKey, PEM);
// Anything that is not a PEM fails the boot rather than failing every
// verification call later with an error that reads like a wrong key.
for (const bad of ["not-a-key", "aGVsbG8gd29ybGQ=", "{}"]) {
  assert.throws(() => load({ CASHFREE_VERIFICATION_PUBLIC_KEY: bad }), /not a PEM public key/);
}

console.log(
  'packages/config/env.ts: PAYMENTS_MODE is strict (a stale "cashfree" fails the boot), CASHFREE_ENV defaults to sandbox, and the Secure ID public key is normalised or refused',
);
