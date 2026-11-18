// Run: npm run check:enquiries
//
// The pure parts of the single "Get in touch" form: what is accepted and what is refused, and the admin's counts.
// (Saving and listing need Firestore and are covered by the admin screen's tests.)

import assert from "node:assert/strict";
import { EnquiryError, ENQUIRY_MESSAGE_MAX, cleanEnquiry, countByType, enquiryTypes } from "./enquiries.ts";

assert.deepEqual([...enquiryTypes], ["advertisement", "collaboration", "general", "support"], "the four kinds the client named");

const ok = { type: "collaboration", name: "  Meera Kulkarni ", email: "  Meera@Example.IN ", senderRole: "artist", message: "  Let us work together.  " } as const;
assert.deepEqual(cleanEnquiry(ok), {
  type: "collaboration",
  name: "Meera Kulkarni",
  email: "meera@example.in",
  senderRole: "artist",
  message: "Let us work together.",
});

for (const [bad, why] of [
  [{ ...ok, name: "   " }, "a name is needed"],
  [{ ...ok, email: "not-an-email" }, "a real email address"],
  [{ ...ok, message: "  " }, "a message"],
  [{ ...ok, message: "x".repeat(ENQUIRY_MESSAGE_MAX + 1) }, "a message that is not enormous"],
  [{ ...ok, type: "spam" }, "one of the four kinds"],
] as const) {
  assert.throws(() => cleanEnquiry(bad as never), EnquiryError, why);
}

assert.deepEqual(
  countByType([
    { type: "advertisement", status: "new" },
    { type: "advertisement", status: "handled" },
    { type: "support", status: "new" },
    { type: "support", status: "new" },
  ]),
  { advertisement: 1, collaboration: 0, general: 0, support: 2 },
  "only what is still new is counted",
);

console.log("enquiries.check.ts: ok");
