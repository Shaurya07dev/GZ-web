// Run: node --experimental-strip-types features/mou/mou-document.check.ts
// The company's block on the MOU: its signature is drawn once the MOU is signed, never before, and never
// when no signatory is configured.

import assert from "node:assert/strict";
import { COMPANY_SIGNATURE_URL, mouFieldValue, type MouFill } from "./mou-document.ts";

const party = { name: null, businessName: null, address: null, mobile: null, email: null, governmentId: null, gstNo: null };
const fill = (over: Partial<MouFill>, company = { name: "GalleryZone Private Limited", designation: "Director & COO" }): MouFill => ({
  parties: { party, company },
  date: "2026-11-13T06:00:00.000Z",
  signed: false,
  signatureName: null,
  signatureDataUrl: null,
  ...over,
});

for (const kind of ["artist", "aggregator"] as const) {
  assert.deepEqual(
    mouFieldValue("company.signature", fill({ signed: true, signatureName: "Meera" }), kind),
    { kind: "signature", name: "Signed electronically", image: COMPANY_SIGNATURE_URL, alt: "Signature of the GalleryZone signatory" },
    `${kind}: a signed MOU carries the company's signature`,
  );
  assert.equal(mouFieldValue("company.signature", fill({}), kind).kind, "pending", `${kind}: before signing it only says it will be signed`);
  assert.equal(
    mouFieldValue("company.signature", fill({ signed: true }, { name: "", designation: "" }), kind).kind,
    "blank",
    `${kind}: no signatory, no signature`,
  );
  assert.deepEqual(mouFieldValue("company.designation", fill({}), kind), { kind: "text", text: "Director & COO" });
}

console.log("mou-document.check.ts: ok");
