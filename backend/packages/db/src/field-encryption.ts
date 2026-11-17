// Transparent at-rest encryption for sensitive scalar fields (bank account
// numbers today, extensible to anything else that must not sit in cleartext
// in Firestore exports / audit log dumps / misconfigured backups).
//
// Shape used for ciphertext: `v1:<ivBase64>:<cipherBase64>:<tagBase64>`.
// The "v1:" prefix lets us detect encrypted vs legacy-plaintext values on
// read, so documents written before this module shipped continue to work
// without a migration; new writes always carry the prefix.
//
// Algorithm: AES-256-GCM. 12-byte random IV per write (NIST recommendation
// for GCM). The 16-byte auth tag is stored with the ciphertext so decrypt
// can verify it has not been tampered with — any bit flip or byte reorder
// in the stored value makes decrypt throw rather than return garbage.
//
// Key source: the backend's `FINANCIAL_ENC_KEY` env var, hex-encoded
// 32 bytes (= 64 hex characters). Generate with:
//     openssl rand -hex 32
// and store it in Railway. Rotating the key requires a decrypt-re-encrypt
// migration — not implemented here because we only have ~0 historical
// encrypted docs at launch.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export class FieldEncryptionError extends Error {}

/**
 * Validates the key once per process boot. Keeps `encryptField` and
 * `decryptField` hot-path-free: no re-parse per call.
 */
function keyFromEnv(): Buffer {
  const raw = process.env.FINANCIAL_ENC_KEY?.trim();
  if (!raw) {
    throw new FieldEncryptionError(
      "FINANCIAL_ENC_KEY is not set. Generate one with `openssl rand -hex 32` and put it on Railway. " +
        "Without it, sensitive-field writes refuse rather than fall back to plaintext.",
    );
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== KEY_BYTES) {
    throw new FieldEncryptionError(
      `FINANCIAL_ENC_KEY must be ${KEY_BYTES} bytes hex-encoded (${KEY_BYTES * 2} hex characters). ` +
        `Got ${key.length} bytes. Generate a fresh one with \`openssl rand -hex 32\`.`,
    );
  }
  return key;
}

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (!cachedKey) cachedKey = keyFromEnv();
  return cachedKey;
}

/**
 * Encrypt a string before storing in Firestore. Null → null (so callers
 * can pipe optional fields through without special-casing). The ciphertext
 * is URL-safe-ish base64 so it survives Firestore's string field.
 */
export function encryptField(plaintext: string | null): string | null {
  if (plaintext === null || plaintext === "") return null;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${enc.toString("base64")}:${tag.toString("base64")}`;
}

/**
 * Decrypt a value stored by `encryptField`. If the value lacks the "v1:"
 * prefix it is treated as a legacy plaintext (so docs written before this
 * module landed still return their account number) — intentional: we do
 * NOT want to force a migration of every pre-encryption row before the
 * admin payout flow goes live. On launch day the only consumers are the
 * admin UI (which will decrypt via this helper) and manual Firebase
 * Console inspections (which will see the ciphertext — fine).
 *
 * Throws FieldEncryptionError on any format or auth-tag failure; never
 * returns a partial / corrupted plaintext.
 */
export function decryptField(stored: string | null): string | null {
  if (!stored) return null;
  if (!stored.startsWith(`${VERSION}:`)) {
    // Legacy pre-encryption row. Return as-is.
    return stored;
  }
  const parts = stored.split(":");
  if (parts.length !== 4) {
    throw new FieldEncryptionError(`Ciphertext does not look like ${VERSION}:iv:cipher:tag.`);
  }
  const [, ivB64, encB64, tagB64] = parts as [string, string, string, string];
  const iv = Buffer.from(ivB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_BYTES) throw new FieldEncryptionError("IV length is wrong.");
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    throw new FieldEncryptionError("Auth tag mismatch — stored value was tampered with or encrypted under a different key.");
  }
}

/** Only used by tests. Lets them inject a key without an env var. */
export function _setKeyForTests(hex: string | null): void {
  if (hex === null) {
    cachedKey = null;
    return;
  }
  cachedKey = Buffer.from(hex, "hex");
}
