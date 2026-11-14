// Run: node --experimental-strip-types lib/artwork-review.check.ts

import assert from "node:assert/strict";
import { artworkReview } from "./artwork-review.ts";

const ev = (status: string, over: Record<string, unknown> = {}) =>
  ({ status, changedAt: "2026-11-01T00:00:00.000Z", changedBy: "u", changedByName: "Priya", changedByRole: "admin", reason: null, ...over }) as Parameters<typeof artworkReview>[0][number];

// Nothing decided yet: the artist submitted it.
assert.equal(artworkReview([ev("draft", { changedByRole: "artist" }), ev("pending_approval", { changedByRole: "artist" })]), null);
assert.equal(artworkReview([]), null);

// Approved by an admin.
assert.deepEqual(artworkReview([ev("pending_approval", { changedByRole: "artist" }), ev("marketplace", { changedAt: "2026-11-02T00:00:00.000Z" })]), {
  adminName: "Priya",
  decision: "approved",
  at: "2026-11-02T00:00:00.000Z",
});

// Rejected with a reason.
assert.equal(artworkReview([ev("pending_approval", { changedByRole: "artist" }), ev("returned", { reason: "Photos are blurry" })])?.decision, "rejected");

// The latest decision wins: rejected, resubmitted, then approved by someone else.
const history = [
  ev("pending_approval", { changedByRole: "artist" }),
  ev("returned", { reason: "Photos are blurry", changedByName: "Priya", changedAt: "2026-11-02T00:00:00.000Z" }),
  ev("pending_approval", { changedByRole: "artist", changedAt: "2026-11-03T00:00:00.000Z" }),
  ev("marketplace", { changedByName: "Ravi", changedAt: "2026-11-04T00:00:00.000Z" }),
];
assert.deepEqual(artworkReview(history), { adminName: "Ravi", decision: "approved", at: "2026-11-04T00:00:00.000Z" });

// Not reviews: an aggregator returning a piece to the marketplace, and an admin delisting a live piece.
assert.equal(artworkReview([ev("marketplace", { changedByRole: "aggregator" })]), null, "a move by an aggregator is not an approval");
assert.equal(artworkReview([ev("returned", { reason: "Delisted by admin" })]), null, "delisting is not a rejection");
assert.equal(artworkReview([ev("returned", { reason: null })]), null, "a return with no reason is not a rejection");
// ...and they do not hide an earlier real review.
assert.equal(artworkReview([ev("marketplace", { changedByName: "Priya" }), ev("returned", { reason: "Delisted by admin" })])?.decision, "approved");

// A missing name still says an admin did it.
assert.equal(artworkReview([ev("marketplace", { changedByName: null })])?.adminName, "An admin");

console.log("artwork-review.check.ts: ok");
