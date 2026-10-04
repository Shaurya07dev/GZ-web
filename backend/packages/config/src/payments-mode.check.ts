// PAYMENTS_MODE decides whether a customer may mark their own order paid
// without paying, so the permissive value must never be reachable by accident.
// This check exists because it very nearly was: renaming the gateway from
// "razorpay" to "cashfree" left PAYMENTS_MODE=razorpay in the environment, and
// a lenient parse turned that stale value into "simulated" — free checkout.

import assert from "node:assert/strict";
import { loadEnv } from "./env.ts";

// The required variables, so loadEnv gets far enough to reach PAYMENTS_MODE.
const base = { FIREBASE_PROJECT_ID: "p", GCP_PROJECT_ID: "p" } as const;
const load = (extra: Record<string, string | undefined>) => loadEnv({ ...base, ...extra } as NodeJS.ProcessEnv);

// The two deliberate values are accepted.
assert.equal(load({ PAYMENTS_MODE: "simulated" }).paymentsMode, "simulated");
assert.equal(load({ PAYMENTS_MODE: "cashfree" }).paymentsMode, "cashfree");

// The exact value this check was written for. It must throw, and the message
// must point at the rename rather than just saying "invalid".
assert.throws(() => load({ PAYMENTS_MODE: "razorpay" }), /razorpay.*moved to Cashfree|not a valid mode/s);

// Anything else unrecognised throws too — no truthy-string shortcuts.
for (const bad of ["true", "1", "live", "production", "Cashfree", "CASHFREE", "simulated ", "razorpayx"]) {
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
assert.equal(load({ NODE_ENV: "production", PAYMENTS_MODE: "cashfree" }).paymentsMode, "cashfree");
assert.equal(load({ NODE_ENV: "production", PAYMENTS_MODE: "simulated" }).paymentsMode, "simulated");

// Cashfree's own environment is the other switch that must not drift open:
// anything other than an explicit "production" stays on sandbox.
assert.equal(load({}).cashfreeEnv, "sandbox");
assert.equal(load({ CASHFREE_ENV: "production" }).cashfreeEnv, "production");
assert.equal(load({ CASHFREE_ENV: "PRODUCTION" }).cashfreeEnv, "production");
assert.equal(load({ CASHFREE_ENV: "sandbox" }).cashfreeEnv, "sandbox");
assert.equal(load({ CASHFREE_ENV: "prod" }).cashfreeEnv, "sandbox");
assert.equal(load({ CASHFREE_ENV: "live" }).cashfreeEnv, "sandbox");

console.log("packages/config/env.ts: PAYMENTS_MODE is strict (a stale \"razorpay\" fails the boot) and CASHFREE_ENV defaults to sandbox");
