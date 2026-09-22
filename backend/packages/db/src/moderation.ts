// Admin moderation decisions — KYC, GST, insurance. Firestore version.
// Every decision still goes through packages/domain's review-queue state
// machines first, and writes its audit_log doc in the SAME Firestore
// transaction as the status change — Firestore transactions give us the
// same "audit gap can never exist" guarantee the Postgres version's
// same-DB-transaction write did.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { gstStateMachine, insuranceStateMachine, kycStateMachine, type ReviewStatus } from "@galleryzone/domain";
import { Collections, userProfileCol, type AuditLogDoc, type ProfileDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class ModerationError extends DbError {}

interface DecisionInput {
  db: Firestore;
  adminId: string;
  decision: "approved" | "rejected";
  reason?: string | undefined;
}

function requireReasonIfRejected(decision: "approved" | "rejected", reason: string | undefined): void {
  if (decision === "rejected" && !reason) {
    throw new ModerationError("A rejection requires a reason");
  }
}

function auditDoc(adminId: string, action: string, entityType: string, entityId: string, reason: string | undefined): AuditLogDoc {
  return {
    adminId,
    action,
    entityType,
    entityId,
    entityLabel: null,
    detail: reason ? { reason } : null,
    createdAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
  };
}

export async function decideGst(input: DecisionInput & { userId: string }): Promise<void> {
  requireReasonIfRejected(input.decision, input.reason);
  const profileRef = input.db.collection(userProfileCol(input.userId)).doc("data");

  await input.db.runTransaction(async (tx) => {
    const snap = await tx.get(profileRef);
    if (!snap.exists) throw new ModerationError(`No profile for user ${input.userId}`);
    const profile = snap.data() as ProfileDoc;
    const current: ReviewStatus = profile.gstStatus ?? "not_submitted";
    gstStateMachine.assertTransition(current, input.decision);

    tx.update(profileRef, { gstStatus: input.decision });
    tx.set(
      input.db.collection(Collections.auditLog).doc(),
      auditDoc(input.adminId, input.decision === "approved" ? "gst.approved" : "gst.rejected", "user", input.userId, input.reason),
    );
  });
}

export async function decideKyc(input: DecisionInput & { userId: string }): Promise<void> {
  requireReasonIfRejected(input.decision, input.reason);
  const profileRef = input.db.collection(userProfileCol(input.userId)).doc("data");

  await input.db.runTransaction(async (tx) => {
    const snap = await tx.get(profileRef);
    if (!snap.exists) throw new ModerationError(`No profile for user ${input.userId}`);
    const profile = snap.data() as ProfileDoc;
    const current: ReviewStatus = profile.aadhaarStatus ?? "not_submitted";
    kycStateMachine.assertTransition(current, input.decision);

    tx.update(profileRef, { aadhaarStatus: input.decision });
    tx.set(
      input.db.collection(Collections.auditLog).doc(),
      auditDoc(input.adminId, input.decision === "approved" ? "kyc.approved" : "kyc.rejected", "user", input.userId, input.reason),
    );
  });
}

export async function decideInsurance(input: DecisionInput & { artworkId: string }): Promise<void> {
  requireReasonIfRejected(input.decision, input.reason);
  const artworkRef = input.db.collection(Collections.artworks).doc(input.artworkId);

  await input.db.runTransaction(async (tx) => {
    const snap = await tx.get(artworkRef);
    if (!snap.exists) throw new ModerationError(`No artwork ${input.artworkId}`);
    const artwork = snap.data() as { insuranceStatus: ReviewStatus | null };
    const current: ReviewStatus = artwork.insuranceStatus ?? "not_submitted";
    insuranceStateMachine.assertTransition(current, input.decision);

    tx.update(artworkRef, { insuranceStatus: input.decision });
    tx.set(
      input.db.collection(Collections.auditLog).doc(),
      auditDoc(input.adminId, input.decision === "approved" ? "insurance.approved" : "insurance.rejected", "artwork", input.artworkId, input.reason),
    );
  });
}
