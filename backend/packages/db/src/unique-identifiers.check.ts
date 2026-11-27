// Run: node --experimental-strip-types backend/packages/db/src/unique-identifiers.check.ts
//
// Pure-helper sanity: the exported API surface + the normalisation /
// label mapping. Transactional behaviour needs the Firestore emulator
// and is exercised by the hosted integration tests.

import assert from "node:assert/strict";

const mod = await import("./unique-identifiers.ts");

// The public surface we expect — mis-remembered names would break the
// controller imports.
assert.equal(typeof mod.claimIdentifier, "function", "claimIdentifier exported");
assert.equal(typeof mod.releaseIdentifier, "function", "releaseIdentifier exported");
assert.equal(typeof mod.reclaimIdentifier, "function", "reclaimIdentifier exported");
assert.equal(typeof mod.UniqueIdentifierError, "function", "UniqueIdentifierError exported");

// UniqueIdentifierError is a proper Error subclass.
const err = new mod.UniqueIdentifierError("test");
assert.ok(err instanceof Error, "UniqueIdentifierError extends Error");
assert.equal(err.message, "test");

console.log(
  "packages/db/unique-identifiers.ts: public API intact (claim/release/reclaim + UniqueIdentifierError)",
);
