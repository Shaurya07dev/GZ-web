// The Cashfree Secure ID 2FA signature, as a pure function.
//
// Secure ID refuses every request that does not satisfy two-factor auth, and
// offers two ways to satisfy it: allow-list the caller's IP, or sign each
// request. A host with no static outbound IP — Railway, here — can only sign,
// so this is the thing standing between us and a verification feature that
// has never once returned an answer.
//
// It lives in `domain` and has its own check for the same reason
// gateway-money.ts did: it is a tiny amount of code at a provider boundary
// where every mistake fails identically at runtime. A wrong hash, a wrong
// timestamp unit and a wrong key all produce the same opaque "signature
// mismatch" from Cashfree, so the only way to tell them apart is to have
// pinned each one here first.

import { constants, publicEncrypt } from "node:crypto";

export class SecureIdSignatureError extends Error {}

/**
 * Builds the value for the `X-Cf-Signature` header.
 *
 * The payload is `<clientId>.<unixSeconds>` encrypted under the account's
 * public key with RSA-OAEP and **SHA-1**, base64-encoded. Cashfree decrypts
 * it, so the three things that must be exactly right are:
 *
 *   - **SHA-1.** Node's OAEP default is SHA-256. Passing nothing silently
 *     produces a ciphertext Cashfree cannot read.
 *   - **Seconds.** `Date.now()` is milliseconds; used directly it reads as a
 *     timestamp roughly fifty thousand years out and is rejected as expired.
 *   - **The oldest client id on the account.** Cashfree validates the
 *     signature against the first key pair ever issued, so a newer client id
 *     fails here while working fine for everything else.
 *
 * OAEP is randomised, so two calls with the same inputs return different
 * strings. That is correct and expected; it also means a caller may cache the
 * result for the few minutes Cashfree accepts it.
 *
 * @param nowMs injectable only so the check can pin the timestamp unit.
 */
export function secureIdSignature(input: { clientId: string; publicKeyPem: string; nowMs?: number }): string {
  const clientId = input.clientId.trim();
  if (clientId.length === 0) throw new SecureIdSignatureError("clientId is empty — nothing to sign");
  if (!input.publicKeyPem.includes("BEGIN")) throw new SecureIdSignatureError("publicKeyPem is not a PEM public key");
  // Node's publicEncrypt accepts a PRIVATE key and quietly derives the public
  // half from it, so this mistake would otherwise work — and leave a private
  // key sitting in an environment variable. Cashfree only ever gives us a
  // public key, so a private one here is always wrong.
  if (input.publicKeyPem.includes("PRIVATE KEY")) {
    throw new SecureIdSignatureError("publicKeyPem is a PRIVATE key — Cashfree issues a public key for this; do not store a private key here");
  }

  const seconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const payload = `${clientId}.${seconds}`;
  try {
    return publicEncrypt(
      { key: input.publicKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
      Buffer.from(payload, "utf8"),
    ).toString("base64");
  } catch (cause) {
    // A key too small for the payload, or a private key pasted where the
    // public one belongs, both land here. Say so rather than letting a raw
    // OpenSSL error surface from inside a verification request.
    throw new SecureIdSignatureError(`could not sign with the Secure ID public key: ${(cause as Error).message}`);
  }
}

/** The payload Cashfree should recover, exposed so the check can assert a real round trip. */
export function secureIdSignaturePayload(clientId: string, nowMs: number): string {
  return `${clientId.trim()}.${Math.floor(nowMs / 1000)}`;
}
