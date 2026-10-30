// Run: node --experimental-strip-types packages/db/src/holding-claim.check.ts
import assert from "node:assert/strict";
import type { Firestore } from "firebase-admin/firestore";
import { HoldingClaimError, claimHoldingExit } from "./holding-claim.ts";

const docs = new Map<string, Record<string, unknown>>();
const ref = (path: string) => ({ path, get: async () => ({ data: () => docs.get(path) }) });
const db = {
  collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`) }),
  runTransaction: async (fn: (tx: unknown) => Promise<void>) =>
    fn({ get: (r: ReturnType<typeof ref>) => r.get(), update: (r: ReturnType<typeof ref>, d: Record<string, unknown>) => void docs.set(r.path, { ...docs.get(r.path), ...d }) }),
} as unknown as Firestore;

docs.set("aggregatorHoldings/h1", { status: "reserved" });
await claimHoldingExit(db, "h1", "sale");
await claimHoldingExit(db, "h1", "sale"); // a retry of the same sale is fine
await assert.rejects(claimHoldingExit(db, "h1", "return"), HoldingClaimError, "a return after a sale started is refused");
assert.equal(docs.get("aggregatorHoldings/h1")!.closingAs, "sale");

docs.set("aggregatorHoldings/h2", { status: "reserved" });
await claimHoldingExit(db, "h2", "return");
await assert.rejects(claimHoldingExit(db, "h2", "sale"), /already being returned/);

await assert.rejects(claimHoldingExit(db, "ghost", "sale"), /No holding/);
console.log("packages/db/holding-claim.ts: a holding leaves one way only; same-way retries allowed");
