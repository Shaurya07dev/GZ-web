import assert from "node:assert/strict";
import { formatCertificateNumber, CoaError } from "./coa.ts";

assert.equal(formatCertificateNumber(2026, 1), "GZ-COA-2026-0001");
assert.equal(formatCertificateNumber(2026, 42), "GZ-COA-2026-0042");
assert.equal(formatCertificateNumber(2027, 12345), "GZ-COA-2027-12345"); // grows past 4 digits, never truncates
assert.throws(() => formatCertificateNumber(2026, 0), CoaError);
assert.throws(() => formatCertificateNumber(2026, 1.5), CoaError);

console.log("packages/db/coa.ts: certificate number format OK");
