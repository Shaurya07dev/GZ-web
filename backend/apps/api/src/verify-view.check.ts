// Run: node --experimental-strip-types apps/api/src/verify-view.check.ts
// A stranger's passport carries no certificate; everything else is untouched.

import assert from "node:assert/strict";
import type { VerifyPassportDto } from "@galleryzone/contracts";
import { withoutCertificate } from "./verify-view.ts";

const full = {
  artworkId: "a1",
  productCode: "GZ000045",
  title: "Test",
  artistId: "u1",
  artistName: "Artist",
  artistSignatureDataUrl: "data:image/png;base64,AAAA",
  category: "painting",
  medium: "oil-on-canvas",
  dimensions: null,
  yearCreated: 2026,
  images: [],
  status: "sold",
  coaCertificateNumber: "GZ-COA-2026-0001",
  coaIssuedAt: "2026-03-14T00:00:00.000Z",
  listedAt: "2026-03-01T00:00:00.000Z",
  owner: { kind: "collector", displayName: "Asha" },
  events: [],
  nfcLinked: true,
  nfcLocked: true,
  lifecycle: [],
} satisfies VerifyPassportDto;

const stranger = withoutCertificate(full);
assert.equal(stranger.coaCertificateNumber, null);
assert.equal(stranger.coaIssuedAt, null);
assert.equal(stranger.artistSignatureDataUrl, null);
assert.equal(stranger.productCode, "GZ000045", "the Display card still needs the product code");
assert.equal(stranger.nfcLocked, true);
assert.equal(full.coaCertificateNumber, "GZ-COA-2026-0001", "the cached full passport must not be mutated");
console.log("verify-view.check.ts: ok");
