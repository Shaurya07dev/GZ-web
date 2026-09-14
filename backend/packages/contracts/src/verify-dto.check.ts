// Run: node --experimental-strip-types packages/contracts/src/verify-dto.check.ts
// Same static gate as artwork-dto.check.ts, applied to the fully public
// passport: no price-shaped field, and no contact-detail-shaped field
// either (this page is reachable by anyone who scans a QR).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("./verify-dto.ts", import.meta.url)), "utf8");
const start = source.indexOf("interface VerifyPassportDto");
assert.ok(start >= 0);
const body = source.slice(source.indexOf("{", start));

const FORBIDDEN_PRICE = /price|paise|cost/i;
const FORBIDDEN_PII = /email|phone|address|pincode|toUserId|fromUserId|customerId|buyerId/i;

assert.ok(!FORBIDDEN_PRICE.test(body), `VerifyPassportDto contains a price-shaped field:
${body}`);
assert.ok(!FORBIDDEN_PII.test(body), `VerifyPassportDto contains a contact/identity field:
${body}`);

console.log("packages/contracts/verify-dto.ts: public passport carries no price or contact fields");
