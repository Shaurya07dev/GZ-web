// Email + phone OTP (one-time password) issuance and verification.
//
// Owner directive 3 Nov 2026: sign-up and password reset use OTP codes, not
// Firebase's email-verification link. Email codes go out through Resend;
// phone codes go out through MSG91. The code itself is six digits generated
// here so the sender integrations (`mail/*`, `sms/*`) only ever handle the
// delivery.
//
// Security notes:
//   - Plaintext codes are NEVER written to Firestore. Only an HMAC-SHA256
//     hash is stored. A dump of this collection can't be replayed to sign
//     anyone in; a stolen DB backup from last week is useless on its own.
//   - Doc id is sha256(channel + ":" + identifier). Same identifier keeps
//     the same doc, so a second /send collapses onto it (replaces the code,
//     keeps the send counter).
//   - Six wrong tries locks the OTP ("too many attempts, request a new one").
//   - Six /send calls in an hour on the same identifier is refused ("too
//     many requests, try again later"). Together these stop spam-dialing
//     and brute-force.
//   - Timing: the controller refuses an expired code before checking the
//     hash, so a correct-but-expired guess leaks nothing by timing.

import { createHash, createHmac, randomInt } from "node:crypto";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { Collections, type OtpDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class OtpError extends DbError {}

/** Keep the plaintext hash secret long enough that leaking it to a log line
 *  isn't catastrophic. 10 minutes is long enough for a user to switch to
 *  their phone and type it, short enough that a stolen hash expires fast. */
const OTP_TTL_MS = 10 * 60 * 1000;

/** Six-digit numeric code. Alphanumerics are harder to type on mobile and
 *  the extra entropy is wasted — brute force is bounded by MAX_ATTEMPTS, not
 *  by the search space. */
const CODE_LENGTH = 6;

/** How many wrong /verify guesses before the OTP locks. The lock lifts when
 *  a new /send issues a new code. */
const MAX_ATTEMPTS = 5;

/** How many /send calls per identifier per rolling hour before further
 *  requests are refused. Protects against SMS cost + email abuse. */
const MAX_SENDS_PER_HOUR = 5;

export type OtpPurpose = OtpDoc["purpose"];
export type OtpChannel = OtpDoc["channel"];

/** The secret used to hash OTP codes before storing. Required at startup —
 *  a boot without it is refused rather than falling back to a hardcoded
 *  value that would silently weaken security in production. */
function otpSecret(): string {
  const secret = process.env.OTP_SECRET;
  if (!secret || secret.length < 32) {
    throw new OtpError(
      "OTP_SECRET must be set to a random string of at least 32 characters. " +
        "Generate one with `openssl rand -hex 32` and store it on Railway. " +
        "Changing it invalidates every in-flight OTP, which is deliberate.",
    );
  }
  return secret;
}

function hashCode(code: string): string {
  return createHmac("sha256", otpSecret()).update(code).digest("base64");
}

function docId(channel: OtpChannel, identifier: string): string {
  return createHash("sha256").update(`${channel}:${identifier}`).digest("hex");
}

function generateCode(): string {
  // Avoid leading zeros — some SMS clients strip them when auto-filling.
  const min = 10 ** (CODE_LENGTH - 1);
  const max = 10 ** CODE_LENGTH;
  return randomInt(min, max).toString();
}

export interface IssueOtpInput {
  db: Firestore;
  channel: OtpChannel;
  /** Email address or phone in `+91XXXXXXXXXX` form. */
  identifier: string;
  purpose: OtpPurpose;
  /** The uid this OTP relates to, when known at send time. */
  uid?: string | null;
}

export interface IssueOtpResult {
  /** The plaintext code to deliver via mail or SMS. Never persisted. */
  code: string;
  /** When the code expires, as an ISO string the caller can show the user. */
  expiresAt: string;
}

/**
 * Issues a fresh OTP for `identifier`. Replaces any pending OTP on the same
 * identifier; the new code is the only one that will verify from now on.
 *
 * Refuses when the identifier has already been sent [MAX_SENDS_PER_HOUR]
 * codes in the past hour.
 */
export async function issueOtp(input: IssueOtpInput): Promise<IssueOtpResult> {
  const ref = input.db.collection(Collections.otps).doc(docId(input.channel, input.identifier));
  const code = generateCode();
  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + OTP_TTL_MS);
  const codeHash = hashCode(code);

  await input.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data() as OtpDoc | undefined;
    // Reset the hourly send counter when the oldest window has rolled off.
    const createdAtMs = current?.createdAt?.toMillis() ?? 0;
    const windowFresh = now - createdAtMs < 60 * 60 * 1000;
    const sendsLastHour = windowFresh ? (current?.sendsLastHour ?? 0) + 1 : 1;
    if (sendsLastHour > MAX_SENDS_PER_HOUR) {
      throw new OtpError(
        `Too many OTP requests. Please wait before trying again, or contact support if you need help.`,
      );
    }
    const doc: OtpDoc = {
      channel: input.channel,
      identifier: input.identifier,
      codeHash,
      expiresAt,
      purpose: input.purpose,
      uid: input.uid ?? null,
      attempts: 0,
      sendsLastHour,
      createdAt: windowFresh && current
        ? current.createdAt
        : (FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp),
      updatedAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
    };
    tx.set(ref, doc);
  });

  return { code, expiresAt: expiresAt.toDate().toISOString() };
}

export interface VerifyOtpInput {
  db: Firestore;
  channel: OtpChannel;
  identifier: string;
  /** The six-digit code the user typed. */
  code: string;
  /** The purpose that must match the stored OTP's purpose — stops a
   *  signup_email code being used as a password_reset. */
  expectedPurpose: OtpPurpose;
}

export interface VerifyOtpResult {
  /** The uid the OTP was issued for (password reset), or null (sign-up). */
  uid: string | null;
}

/**
 * Verifies a code against the stored hash. Consumes the OTP on success so a
 * replay fails. Counts wrong tries and locks after [MAX_ATTEMPTS].
 */
export async function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  const ref = input.db.collection(Collections.otps).doc(docId(input.channel, input.identifier));
  return input.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new OtpError("No OTP was requested for this address.");
    const doc = snap.data() as OtpDoc;
    if (doc.purpose !== input.expectedPurpose) {
      // Separate error, but phrased like the "no OTP" case so the attacker
      // learns nothing from the shape of the response.
      throw new OtpError("No OTP was requested for this address.");
    }
    if (doc.expiresAt.toMillis() < Date.now()) {
      throw new OtpError("That code has expired. Request a new one.");
    }
    if (doc.attempts >= MAX_ATTEMPTS) {
      throw new OtpError("Too many wrong attempts. Request a new code.");
    }
    const guessHash = hashCode(input.code.trim());
    if (guessHash !== doc.codeHash) {
      tx.update(ref, { attempts: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      throw new OtpError("That code is not correct. Try again.");
    }
    // Correct. Delete so a replay fails.
    tx.delete(ref);
    return { uid: doc.uid };
  });
}

/** For tests that need to force an immediate lockout without burning codes. */
export const _OtpInternals = { OTP_TTL_MS, MAX_ATTEMPTS, MAX_SENDS_PER_HOUR, CODE_LENGTH };
