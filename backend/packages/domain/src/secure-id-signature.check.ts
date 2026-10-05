// Pins the Secure ID 2FA signature by actually decrypting it.
//
// We don't hold Cashfree's private key, so the only honest way to prove this
// is a real round trip: generate a key pair here, sign with the public half,
// decrypt with the private half, and assert Cashfree would recover exactly
// the payload it expects. That catches the wrong-hash and wrong-timestamp-unit
// mistakes locally, instead of as an opaque "signature mismatch" from a
// production verification call.

import assert from "node:assert/strict";
import { constants, generateKeyPairSync, privateDecrypt } from "node:crypto";
import { SecureIdSignatureError, secureIdSignature, secureIdSignaturePayload } from "./secure-id-signature.ts";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const CLIENT_ID = "CF10000000ABCDEFGH";
const NOW_MS = 1_767_225_600_000; // 2026-01-01T00:00:00Z, in milliseconds
const EXPECTED_SECONDS = 1_767_225_600;

const decrypt = (signature: string, oaepHash: string): string =>
  privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash },
    Buffer.from(signature, "base64"),
  ).toString("utf8");

// The round trip Cashfree performs: decrypt with SHA-1 and read the payload.
const signature = secureIdSignature({ clientId: CLIENT_ID, publicKeyPem: publicKey, nowMs: NOW_MS });
assert.equal(decrypt(signature, "sha1"), `${CLIENT_ID}.${EXPECTED_SECONDS}`);
assert.equal(decrypt(signature, "sha1"), secureIdSignaturePayload(CLIENT_ID, NOW_MS));

// SECONDS, not milliseconds. This is the assertion that would have caught
// shipping Date.now() straight through: the timestamp must be ten digits, not
// thirteen, or Cashfree reads it as a date far in the future and expires it.
const [, stamp] = decrypt(signature, "sha1").split(".");
assert.equal(stamp, String(EXPECTED_SECONDS));
assert.equal(stamp!.length, 10, "the timestamp must be unix SECONDS");

// SHA-1, not SHA-256. Node defaults OAEP to SHA-256, so this proves the
// explicit oaepHash is actually taking effect — decrypting the same bytes
// with SHA-256 must fail.
assert.throws(() => decrypt(signature, "sha256"), /decrypt|oaep|padding/i);

// The output is base64 and nothing else, because it travels in a header.
assert.match(signature, /^[A-Za-z0-9+/]+=*$/);

// OAEP is randomised: two signatures over identical input differ. If these
// ever matched, the padding would not be OAEP and the scheme would be weaker
// than Cashfree specifies.
assert.notEqual(signature, secureIdSignature({ clientId: CLIENT_ID, publicKeyPem: publicKey, nowMs: NOW_MS }));

// A later call carries a later timestamp, so a cached signature really does
// expire rather than being frozen at boot.
const later = decrypt(secureIdSignature({ clientId: CLIENT_ID, publicKeyPem: publicKey, nowMs: NOW_MS + 60_000 }), "sha1");
assert.equal(later, `${CLIENT_ID}.${EXPECTED_SECONDS + 60}`);

// Surrounding whitespace on the client id is trimmed, since an env var pasted
// with a trailing newline would otherwise sign a client id that doesn't exist.
assert.equal(decrypt(secureIdSignature({ clientId: `  ${CLIENT_ID}\n`, publicKeyPem: publicKey, nowMs: NOW_MS }), "sha1"), `${CLIENT_ID}.${EXPECTED_SECONDS}`);

// Refusals, all of them loud rather than producing a signature nobody can use.
assert.throws(() => secureIdSignature({ clientId: "", publicKeyPem: publicKey }), SecureIdSignatureError);
assert.throws(() => secureIdSignature({ clientId: "   ", publicKeyPem: publicKey }), SecureIdSignatureError);
assert.throws(() => secureIdSignature({ clientId: CLIENT_ID, publicKeyPem: "not-a-key" }), /not a PEM/);
// A private key pasted where the public one belongs is a plausible mistake,
// and the dangerous part is that it WORKS: node's publicEncrypt derives the
// public half and produces a perfectly valid signature, so nothing would ever
// surface the fact that a private key is sitting in an env var. Hence an
// explicit refusal rather than relying on the crypto to complain.
assert.throws(() => secureIdSignature({ clientId: CLIENT_ID, publicKeyPem: privateKey }), /PRIVATE key/);

console.log("packages/domain/secure-id-signature.ts: X-Cf-Signature round-trips under RSA-OAEP/SHA-1 with a unix-SECONDS timestamp");
