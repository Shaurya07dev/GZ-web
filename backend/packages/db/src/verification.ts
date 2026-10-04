// Cashfree Secure ID outcomes, recorded against a profile.
//
// The deliberate design decision here: a machine check is EVIDENCE, not an
// approval. `gstStatus` and `aadhaarStatus` keep moving exactly as they did
// before — an admin decides, in moderation.ts — and this module only attaches
// what the registry said, who it said it about, and when. Two reasons:
//
//   - hasApprovedGst() gates GST invoicing and the §194-O TDS threshold. A
//     third-party API result should not move a tax path on its own.
//   - A valid GSTIN is not the same claim as "this GSTIN belongs to this
//     artist". The registry confirms the former; a human confirms the latter,
//     and now does so with the registry's answer in front of them.
//
// A check that comes back `valid` still advances the profile from
// "not_submitted" to "submitted", because that is the state that puts it in
// the admin queue. A check that fails records the failure and leaves the
// status alone, so a failed lookup can never quietly undo an approval.
//
// Nothing here stores a raw Aadhaar number. DigiLocker returns a masked value
// and that is the only form that is ever written.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { Collections, userProfileCol, type ProfileDoc, type VerificationEvidence } from "./collections.ts";
import { DbError } from "./errors.ts";

export class VerificationError extends DbError {}

const profileRef = (db: Firestore, uid: string) => db.collection(userProfileCol(uid)).doc("data");

async function currentProfile(db: Firestore, uid: string): Promise<Partial<ProfileDoc>> {
  const snap = await profileRef(db, uid).get();
  if (!snap.exists) throw new VerificationError(`No profile for ${uid}`);
  return snap.data() as Partial<ProfileDoc>;
}

/** The GSTIN this user actually saved. Verification never takes one from the request body. */
export async function savedGstin(db: Firestore, uid: string): Promise<{ gstin: string; companyName: string | null }> {
  const profile = await currentProfile(db, uid);
  if (!profile.gstin) throw new VerificationError("Save your GSTIN on your profile before verifying it");
  return { gstin: profile.gstin, companyName: profile.companyName ?? null };
}

/**
 * Record a GSTIN check. A `valid` result moves an untouched profile into the
 * admin queue; it never sets "approved", and a failure never clears one.
 */
export async function recordGstinCheck(
  db: Firestore,
  uid: string,
  result: { valid: boolean; referenceId: string | null; legalName: string | null; detail: Record<string, unknown> | null },
): Promise<void> {
  const profile = await currentProfile(db, uid);
  const evidence: Omit<VerificationEvidence, "checkedAt"> & { checkedAt: FieldValue } = {
    provider: "cashfree_gstin",
    outcome: result.valid ? "valid" : "invalid",
    referenceId: result.referenceId,
    verifiedName: result.legalName,
    detail: result.detail,
    checkedAt: FieldValue.serverTimestamp(),
  };
  const patch: Record<string, unknown> = { gstVerification: evidence };
  // Only ever forward, and only as far as "an admin should look at this".
  if (result.valid && (profile.gstStatus ?? "not_submitted") === "not_submitted") patch.gstStatus = "submitted";
  await profileRef(db, uid).set(patch, { merge: true });
}

/**
 * Record a DigiLocker outcome from the Secure ID webhook. `aadhaarMasked` is
 * written only on success and only ever as the masked form.
 */
export async function recordDigiLockerOutcome(
  db: Firestore,
  uid: string,
  result: { success: boolean; referenceId: string | null; verifiedName: string | null; aadhaarMasked: string | null; detail: Record<string, unknown> | null },
): Promise<void> {
  const profile = await currentProfile(db, uid);
  const evidence: Omit<VerificationEvidence, "checkedAt"> & { checkedAt: FieldValue } = {
    provider: "cashfree_digilocker",
    outcome: result.success ? "valid" : "failed",
    referenceId: result.referenceId,
    verifiedName: result.verifiedName,
    detail: result.detail,
    checkedAt: FieldValue.serverTimestamp(),
  };
  const patch: Record<string, unknown> = { aadhaarVerification: evidence };
  if (result.success) {
    if (result.aadhaarMasked) patch.aadhaarMasked = maskAadhaar(result.aadhaarMasked);
    if ((profile.aadhaarStatus ?? "not_submitted") === "not_submitted") patch.aadhaarStatus = "submitted";
  }
  await profileRef(db, uid).set(patch, { merge: true });
}

/**
 * Defence in depth on the one field where a provider mistake would be
 * expensive: whatever DigiLocker returns, only the last four digits are kept.
 * If a full twelve-digit number ever arrives, it is masked here rather than
 * stored as-is.
 */
export function maskAadhaar(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "XXXXXXXXXXXX";
  return `XXXXXXXX${digits.slice(-4)}`;
}

/**
 * A pending DigiLocker session, so the webhook can map Cashfree's
 * verification_id back to the user who started it. Short-lived by nature —
 * Cashfree's consent URL expires in about ten minutes.
 */
export async function openDigiLockerSession(db: Firestore, input: { verificationId: string; uid: string; referenceId: string | null }): Promise<void> {
  await db.collection(Collections.verificationSessions).doc(input.verificationId).set({
    uid: input.uid,
    kind: "digilocker",
    referenceId: input.referenceId,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** Who started this verification. Returns null for an id we never issued, so a forged webhook matches nothing. */
export async function userForVerification(db: Firestore, verificationId: string): Promise<string | null> {
  const snap = await db.collection(Collections.verificationSessions).doc(verificationId).get();
  if (!snap.exists) return null;
  return (snap.data() as { uid?: string }).uid ?? null;
}
