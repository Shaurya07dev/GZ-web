// The public face of the passport. Kept apart from verify.controller.ts because that file carries Nest
// decorators, which the *.check.ts runner (node --experimental-strip-types) cannot load.

import type { VerifyPassportDto } from "@galleryzone/contracts";

/** What a stranger who taps the tag gets: the passport without the certificate (number, issue date, signature). */
export function withoutCertificate(passport: VerifyPassportDto): VerifyPassportDto {
  return { ...passport, coaCertificateNumber: null, coaIssuedAt: null, artistSignatureDataUrl: null };
}
