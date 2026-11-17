// Run: node --experimental-strip-types packages/db/src/broadcasts.check.ts
// Who a broadcast reaches, and how its inbox preview reads.

import assert from "node:assert/strict";
import { previewOf, recipientsOf } from "./broadcasts.ts";

const users = [
  { id: "a1", role: "artist", status: "active" },
  { id: "a2", role: "artist", status: "pending" },
  { id: "a3", role: "artist", status: "suspended" },
  { id: "a4", role: "artist", status: "blocked" },
  { id: "g1", role: "aggregator", status: "active" },
  { id: "c1", role: "customer", status: "active" },
  { id: "x1", role: "admin", status: "active" },
];

assert.deepEqual(recipientsOf(users, ["artist"]), ["a1", "a2"], "artists, not suspended or blocked ones");
assert.deepEqual(recipientsOf(users, ["aggregator"]), ["g1"]);
assert.deepEqual(recipientsOf(users, ["artist", "aggregator"]), ["a1", "a2", "g1"], "both audiences together");
assert.deepEqual(recipientsOf(users, []), [], "no audience, no recipients");
assert.deepEqual(recipientsOf(users, ["customer"]), ["c1"], "the function does what it is told; the API only offers artist and aggregator");

assert.equal(previewOf("Short note"), "Short note");
assert.equal(previewOf("  line one\n\n  line   two  "), "line one line two", "whitespace and line breaks collapse");
const long = "word ".repeat(60);
const preview = previewOf(long);
assert.ok(preview.length <= 120 && preview.endsWith("…"), "a long message is cut with an ellipsis");

console.log("broadcasts.check.ts: ok");
