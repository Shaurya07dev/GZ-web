// Run: node --experimental-strip-types lib/mock-db.check.ts
//
// Guards the one failure mode this file has caused in production: a seed gains
// a field, someone who already used the site still has the old object in
// localStorage, and every page reading the new field crashes for them and
// nobody else. The server renders from a fresh seed and looks perfectly fine,
// which is what makes it so easy to miss.

import assert from "node:assert/strict";

// A localStorage stand-in, installed before importing the module under test.
const store = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};
(globalThis as unknown as { window: unknown }).window = { localStorage };

const { getCollection, setCollection } = await import("./mock-db.ts");

// --- A seed that grows a field --------------------------------------------

// Someone used the site back when the profile had two fields.
setCollection("profile", { name: "Meher", phone: "+91 98450 12345" });

// Today's seed has a third. Their stored copy must come back with it filled in,
// and with their own edits untouched.
const seedNow = () => ({
  name: "Seed Name",
  phone: "+91 00000 00000",
  coordinatorPhone: "+91 98450 33127",
});
const merged = getCollection("profile", seedNow);

assert.equal(merged.name, "Meher", "stored values win over the seed");
assert.equal(merged.phone, "+91 98450 12345", "stored values win over the seed");
assert.equal(
  merged.coordinatorPhone,
  "+91 98450 33127",
  "a field added to the seed since arrives with its default, not undefined",
);

// The specific crash: reading a newly-added field must never be undefined.
assert.notEqual(
  merged.coordinatorPhone,
  undefined,
  "undefined here is what broke /aggregator/profile",
);

// --- Explicit nulls and empty strings are the user's, not gaps -------------

setCollection("profile2", { gstin: "", note: null });
const kept = getCollection("profile2", () => ({
  gstin: "29ABCDE1234F1Z5",
  note: "seed note",
}));
assert.equal(kept.gstin, "", "a field the user cleared stays cleared");
assert.equal(kept.note, null, "an explicit null is a value, not an absence");

// --- Arrays are never merged ------------------------------------------------

// A stored list is the truth about that list. Merging it against a fixture
// would resurrect rows the user deleted.
setCollection("rows", [{ id: "a" }]);
const rows = getCollection("rows", () => [{ id: "a" }, { id: "b" }]);
assert.deepEqual(rows, [{ id: "a" }], "a stored array is returned as-is");

// --- First read still seeds -------------------------------------------------

const fresh = getCollection("never-written", () => ({ hello: "world" }));
assert.deepEqual(fresh, { hello: "world" });
assert.equal(
  store.get("gz-db-v1:never-written"),
  JSON.stringify({ hello: "world" }),
  "the seed is persisted on first read",
);

// --- Corrupt values reseed rather than throw --------------------------------

store.set("gz-db-v1:broken", "{not json");
assert.deepEqual(
  getCollection("broken", () => ({ ok: true })),
  { ok: true },
  "a corrupt value falls back to the seed",
);

console.log("lib/mock-db.ts checks passed");
