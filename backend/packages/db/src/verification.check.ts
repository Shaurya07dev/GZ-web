// Run: node --experimental-strip-types packages/db/src/verification.check.ts
// DigiLocker webhooks: a replayed or late OLDER event never overwrites a newer
// outcome, and Aadhaar is masked whatever the provider sends.

import assert from "node:assert/strict";
import type { Firestore } from "firebase-admin/firestore";
import { maskAadhaar, recordDigiLockerOutcome, webhookTimestampMs } from "./verification.ts";

type Data = Record<string, unknown>;
const docs = new Map<string, Data>();
const db = {
  collection: (col: string) => ({
    doc: (id: string) => ({
      get: async () => ({ exists: docs.has(`${col}/${id}`), data: () => docs.get(`${col}/${id}`) }),
      set: async (patch: Data) => void docs.set(`${col}/${id}`, { ...(docs.get(`${col}/${id}`) ?? {}), ...patch }),
    }),
  }),
} as unknown as Firestore;
const profile = () => docs.get("users/u1/profile/data")!;

assert.equal(webhookTimestampMs("1761800000"), 1_761_800_000_000, "seconds are scaled to ms");
assert.equal(webhookTimestampMs("1761800000123"), 1_761_800_000_123, "ms are kept");
for (const bad of [undefined, "", "abc", "-5"]) assert.equal(webhookTimestampMs(bad), null, String(bad));

docs.set("users/u1/profile/data", { aadhaarStatus: "not_submitted" });
const base = { referenceId: "r", verifiedName: "A", detail: null };

assert.equal(await recordDigiLockerOutcome(db, "u1", { ...base, success: false, aadhaarMasked: null, eventAtMs: 1_000 }), "recorded");
assert.equal(await recordDigiLockerOutcome(db, "u1", { ...base, success: true, aadhaarMasked: "123412341234", eventAtMs: 2_000 }), "recorded");
assert.equal(profile().aadhaarStatus, "submitted");
assert.equal(profile().aadhaarMasked, "XXXXXXXX1234");

// The old failure replayed: ignored, the success stands.
assert.equal(await recordDigiLockerOutcome(db, "u1", { ...base, success: false, aadhaarMasked: null, eventAtMs: 1_000 }), "stale");
assert.equal((profile().aadhaarVerification as { outcome: string }).outcome, "valid");

// No timestamp (older clients/tests) still records, as before.
assert.equal(await recordDigiLockerOutcome(db, "u1", { ...base, success: true, aadhaarMasked: null }), "recorded");

assert.equal(maskAadhaar("1234 5678 9012"), "XXXXXXXX9012");

console.log("packages/db/verification.ts: stale DigiLocker events ignored, timestamps normalised, Aadhaar masked");
