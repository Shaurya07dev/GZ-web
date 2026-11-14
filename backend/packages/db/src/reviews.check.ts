// Run: node --experimental-strip-types packages/db/src/reviews.check.ts
// The newest decision wins per entity, and the decision is read off the audit action.

import assert from "node:assert/strict";
import { decisionOf, latestPerEntity } from "./reviews.ts";

assert.equal(decisionOf("gst.approved"), "approved");
assert.equal(decisionOf("kyc.rejected"), "rejected");
assert.equal(decisionOf("external_sale_fee.waived"), "waived");
assert.equal(decisionOf("approved"), "approved", "no dot, nothing to cut");

const rows = [
  { entityId: "u1", adminId: "a1", action: "gst.rejected", at: 100 },
  { entityId: "u1", adminId: "a2", action: "gst.approved", at: 300 },
  { entityId: "u2", adminId: "a1", action: "gst.approved", at: 200 },
  { entityId: "u1", adminId: "a3", action: "gst.rejected", at: 200 },
];
const latest = latestPerEntity(rows);
assert.equal(latest.size, 2);
assert.equal(latest.get("u1")?.adminId, "a2", "the newest row wins even when it is not last in the list");
assert.equal(latest.get("u2")?.adminId, "a1");
assert.equal(latestPerEntity([]).size, 0);

// Same time: the later row in the list wins, so a re-decision within the same millisecond is not lost.
const tie = latestPerEntity([
  { entityId: "u1", adminId: "first", at: 5 },
  { entityId: "u1", adminId: "second", at: 5 },
]);
assert.equal(tie.get("u1")?.adminId, "second");

console.log("reviews.check.ts: ok");
