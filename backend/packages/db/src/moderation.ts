// Admin moderation decisions — KYC, GST. Firestore version.
// Every decision still goes through packages/domain's review-queue state
// machines first, and writes its audit_log doc in the SAME Firestore
// transaction as the status change — Firestore transactions give us the
// same "audit gap can never exist" guarantee the Postgres version's
// same-DB-transaction write did.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { gstStateMachine, kycStateMachine, payoutStateMachine, type ReviewStatus } from "@galleryzone/domain";
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
  if (decision === "rejected" && !reason?.trim()) {
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

// Returns the audit entry's id: one per decision, so each decision can be told apart (e.g. one email each).
export async function decideGst(input: DecisionInput & { userId: string }): Promise<{ decisionId: string }> {
  requireReasonIfRejected(input.decision, input.reason);
  const profileRef = input.db.collection(userProfileCol(input.userId)).doc("data");
  const auditRef = input.db.collection(Collections.auditLog).doc();

  await input.db.runTransaction(async (tx) => {
    const snap = await tx.get(profileRef);
    if (!snap.exists) throw new ModerationError(`No profile for user ${input.userId}`);
    const profile = snap.data() as ProfileDoc;
    const current: ReviewStatus = profile.gstStatus ?? "not_submitted";
    gstStateMachine.assertTransition(current, input.decision);

    tx.update(profileRef, { gstStatus: input.decision, gstReviewNote: input.decision === "rejected" ? (input.reason?.trim() ?? null) : null });
    tx.set(auditRef, auditDoc(input.adminId, input.decision === "approved" ? "gst.approved" : "gst.rejected", "user", input.userId, input.reason));
  });
  return { decisionId: auditRef.id };
}

// Returns the audit entry's id: one per decision, so each decision can be told apart (e.g. one email each).
//
// KYC approval no longer gates on bank details — that was the right behaviour
// when KYC was the only approval, but as of 19 Nov 2026 we split payout into
// its own admin decision (decidePayout below). An artist can be KYC-verified
// (identity confirmed) without yet having payout approval (bank destination
// confirmed), and vice-versa. Both are required before settlements release.
export async function decideKyc(input: DecisionInput & { userId: string }): Promise<{ decisionId: string }> {
  requireReasonIfRejected(input.decision, input.reason);
  const profileRef = input.db.collection(userProfileCol(input.userId)).doc("data");
  const auditRef = input.db.collection(Collections.auditLog).doc();

  await input.db.runTransaction(async (tx) => {
    const snap = await tx.get(profileRef);
    if (!snap.exists) throw new ModerationError(`No profile for user ${input.userId}`);
    const profile = snap.data() as ProfileDoc;
    const current: ReviewStatus = profile.aadhaarStatus ?? "not_submitted";
    kycStateMachine.assertTransition(current, input.decision);

    tx.update(profileRef, { aadhaarStatus: input.decision, aadhaarReviewNote: input.decision === "rejected" ? (input.reason?.trim() ?? null) : null });
    tx.set(auditRef, auditDoc(input.adminId, input.decision === "approved" ? "kyc.approved" : "kyc.rejected", "user", input.userId, input.reason));
  });
  return { decisionId: auditRef.id };
}

/**
 * Payout approval — admin confirms the artist's bank account + IFSC before
 * any settlement can release funds. Mirrors decideKyc / decideGst exactly:
 * state machine transition inside the TX, audit entry in the same TX, per-
 * decision audit id returned so one email fires per decision.
 *
 * Approval is refused unless BOTH bankAccountMasked and ifsc are on file —
 * the admin can't rubber-stamp an empty destination even if payoutStatus
 * somehow got flipped to "submitted" without both fields being present.
 */
export async function decidePayout(input: DecisionInput & { userId: string }): Promise<{ decisionId: string }> {
  requireReasonIfRejected(input.decision, input.reason);
  const profileRef = input.db.collection(userProfileCol(input.userId)).doc("data");
  const auditRef = input.db.collection(Collections.auditLog).doc();

  await input.db.runTransaction(async (tx) => {
    const snap = await tx.get(profileRef);
    if (!snap.exists) throw new ModerationError(`No profile for user ${input.userId}`);
    const profile = snap.data() as ProfileDoc;
    const current: ReviewStatus = profile.payoutStatus ?? "not_submitted";
    payoutStateMachine.assertTransition(current, input.decision);

    if (input.decision === "approved") {
      const hasBankAccount = Boolean(profile.bankAccountMasked?.trim());
      const hasIfsc = Boolean(profile.ifsc?.trim());
      if (!hasBankAccount || !hasIfsc) {
        throw new ModerationError(
          "Can't approve payout — the artist hasn't saved both a bank account and an IFSC yet.",
        );
      }
    }

    tx.update(profileRef, {
      payoutStatus: input.decision,
      payoutReviewNote: input.decision === "rejected" ? (input.reason?.trim() ?? null) : null,
    });
    tx.set(auditRef, auditDoc(input.adminId, input.decision === "approved" ? "payout.approved" : "payout.rejected", "user", input.userId, input.reason));
  });
  return { decisionId: auditRef.id };
}

