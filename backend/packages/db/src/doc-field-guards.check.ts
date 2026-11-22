// Run: node --experimental-strip-types backend/packages/db/src/doc-field-guards.check.ts
//
// Pre-stamp guards must refuse a profile with any required pickup field
// blank, and must name the missing field in the error so ops can fix
// the underlying data.

import assert from "node:assert/strict";
import {
  assertCompleteBuyerAddress,
  assertCompletePickupProfile,
  textOrMissing,
} from "./doc-field-guards.ts";

class TestErr extends Error {}

const okProfile = {
  pickupLine1: "12 Studio Lane",
  pickupLine2: "Apt 2B",
  pickupCity: "Jaipur",
  pickupState: "Rajasthan",
  pickupPincode: "302001",
} as unknown as import("./collections.ts").ProfileDoc;

// Happy path.
assertCompletePickupProfile("Artist", okProfile, TestErr);

// pickupLine2 may be null — not required.
assertCompletePickupProfile(
  "Artist",
  { ...okProfile, pickupLine2: null } as unknown as import("./collections.ts").ProfileDoc,
  TestErr,
);

// Whitespace counts as blank on every required field.
for (const field of ["pickupLine1", "pickupCity", "pickupState", "pickupPincode"] as const) {
  assert.throws(
    () =>
      assertCompletePickupProfile(
        "Artist",
        { ...okProfile, [field]: "   " } as unknown as import("./collections.ts").ProfileDoc,
        TestErr,
      ),
    (err) => err instanceof TestErr && err.message.includes("Artist profile is missing"),
    `blank ${field} should throw`,
  );
}

// Undefined profile is caught too.
assert.throws(
  () => assertCompletePickupProfile("Aggregator", undefined, TestErr),
  (err) => err instanceof TestErr && err.message.includes("Aggregator profile is missing"),
  "undefined profile should throw",
);

// Buyer address — AddressDoc has different field names.
const okAddress = {
  line1: "4 Collector Road",
  line2: null,
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
} as unknown as import("./collections.ts").AddressDoc;

assertCompleteBuyerAddress(okAddress, TestErr);

for (const field of ["line1", "city", "state", "pincode"] as const) {
  assert.throws(
    () =>
      assertCompleteBuyerAddress(
        { ...okAddress, [field]: "" } as unknown as import("./collections.ts").AddressDoc,
        TestErr,
      ),
    (err) => err instanceof TestErr && err.message.includes("Buyer address is missing"),
    `blank ${field} should throw`,
  );
}

// textOrMissing is the render-side guard — only empty-string gets flagged.
assert.equal(textOrMissing("Jaipur"), "Jaipur", "non-empty string passes through trimmed");
assert.equal(textOrMissing(" Jaipur "), "Jaipur", "whitespace is trimmed");
assert.equal(textOrMissing(""), "— MISSING —", "empty string flags visibly");
assert.equal(textOrMissing("   "), "— MISSING —", "whitespace-only flags visibly");
assert.equal(textOrMissing(null), null, "null stays null (renderer omits)");
assert.equal(textOrMissing(undefined), null, "undefined stays null (renderer omits)");

console.log(
  "packages/db/doc-field-guards.ts: profile + buyer-address guards throw with named field; textOrMissing distinguishes blank-required from legitimately-absent",
);
