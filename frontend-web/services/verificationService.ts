// Identity and business verification, through Cashfree Secure ID on the API.
//
// Two things this layer is careful about, both for the same reason: a machine
// check is EVIDENCE, not an approval, and the artist must never be told
// otherwise.
//
//   1. A passing GSTIN check does not approve anything. The API advances the
//      status to "submitted" (into the admin queue) and an admin decides,
//      because the GST flag drives invoicing and the §194-O TDS threshold. So
//      the copy says "an admin will confirm", never "verified".
//   2. A failure to REACH the registry is not a verdict about the artist. The
//      API separates these with distinct codes, and `isUnavailable` below is
//      what keeps a misconfiguration on our side from being rendered as
//      "your GSTIN is invalid" — the bug that shipped once already.
//
// The Aadhaar flow deliberately returns only a consent URL. The outcome
// arrives on a webhook after the artist consents on DigiLocker's own site, so
// nothing here reports success; the profile is refetched instead.

import { http, isApiError } from "@/lib/api";

export interface GstinCheckResult {
  valid: boolean;
  legalName: string | null;
  tradeName: string | null;
  registrationStatus: string | null;
  /** "submitted" once a pass is in the admin queue; "not_verified" on a fail. */
  status: "submitted" | "not_verified";
  message: string | null;
}

export interface DigiLockerStart {
  consentUrl: string;
  verificationId: string;
  expiresInSeconds: number;
}

/**
 * True when the API could not reach the registry at all, as opposed to the
 * registry answering "no such registration".
 *
 * These are the codes for our own misconfiguration — Secure ID's two 2FA
 * factors, and anything else upstream. Treating one of them as a verdict
 * would accuse an artist of a bad registration number because a key or an
 * allow-list is wrong, so callers must branch on this before showing a
 * failure.
 */
export function isUnavailable(error: unknown): boolean {
  return (
    isApiError(error) &&
    (error.code === "verification_unavailable" ||
      error.code === "verification_ip_not_whitelisted" ||
      error.code === "verification_signature_rejected" ||
      error.code === "verification_upstream_error")
  );
}

export const verificationService = {
  /**
   * Check the GSTIN already saved on the profile. It is deliberately not a
   * parameter: the API reads it from the caller's own record, so this is not a
   * free GST-registry lookup for anyone with an account.
   */
  verifyGstin: (): Promise<GstinCheckResult> => http.post<GstinCheckResult>("/v1/profile/gstin/verify"),

  /** Open a DigiLocker consent session. Short-lived — the caller must redirect immediately. */
  startAadhaarDigiLocker: (): Promise<DigiLockerStart> => http.post<DigiLockerStart>("/v1/profile/aadhaar/digilocker"),
};
