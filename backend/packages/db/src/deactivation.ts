// Artist account deactivation requests + external-sale penalty decisions —
// Firestore version. Deactivation status is still tracked as auditLog
// docs keyed by user (no dedicated collection — the request/decision IS
// the audit event, same reasoning as the Postgres version).

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { deactivationStateMachine, penaltyStateMachine, type DeactivationStatus, type PenaltyStatus } from "@galleryzone/domain";
import { Collections, type AuditLogDoc, type ExternalSalePenaltyDoc } from "./collections.ts";

export class DeactivationError extends Error {}

async function latestDeactivationStatus(db: Firestore, userId: string): Promise<DeactivationStatus | "none"> {
  const snap = await db.collection(Collections.auditLog).where("entityId", "==", userId).orderBy("createdAt").get();
  const deactivationRows = snap.docs.map((d) => d.data() as AuditLogDoc).filter((r) => r.action.startsWith("deactivation."));
  const latest = deactivationRows[deactivationRows.length - 1];
  if (!latest) return "none";
  if (latest.action === "deactivation.requested") return "pending";
  if (latest.action === "deactivation.approved") return "approved";
  if (latest.action === "deactivation.rejected") return "rejected";
  return "none";
}

export async function requestDeactivation(db: Firestore, userId: string, reason: string): Promise<void> {
  const current = await latestDeactivationStatus(db, userId);
  if (current === "pending") throw new DeactivationError("A deactivation request is already pending");
  await db.collection(Collections.auditLog).add({
    adminId: userId,
    action: "deactivation.requested",
    entityType: "user",
    entityId: userId,
    entityLabel: null,
    detail: { reason },
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function decideDeactivation(db: Firestore, userId: string, adminId: string, decision: "approved" | "rejected", note?: string): Promise<void> {
  const current = await latestDeactivationStatus(db, userId);
  if (current === "none") throw new DeactivationError("No deactivation request to decide");
  deactivationStateMachine.assertTransition(current, decision);

  const userRef = db.collection(Collections.users).doc(userId);
  await db.runTransaction(async (tx) => {
    if (decision === "approved") tx.update(userRef, { status: "suspended" });
    tx.set(db.collection(Collections.auditLog).doc(), {
      adminId,
      action: `deactivation.${decision}`,
      entityType: "user",
      entityId: userId,
      entityLabel: null,
      detail: note ? { note } : null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

// --- External-sale penalties -------------------------------------------------

export async function listExternalSaleFees(db: Firestore): Promise<(ExternalSalePenaltyDoc & { id: string })[]> {
  const snap = await db.collection(Collections.externalSalePenalties).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ExternalSalePenaltyDoc) }));
}

export async function decideExternalSaleFee(db: Firestore, penaltyId: string, adminId: string, decision: Exclude<PenaltyStatus, "pending_review">, note?: string): Promise<void> {
  const ref = db.collection(Collections.externalSalePenalties).doc(penaltyId);
  const snap = await ref.get();
  if (!snap.exists) throw new DeactivationError(`No penalty ${penaltyId}`);
  const penalty = snap.data() as ExternalSalePenaltyDoc;
  penaltyStateMachine.assertTransition(penalty.status, decision);

  await db.runTransaction(async (tx) => {
    tx.update(ref, { status: decision, decidedAt: FieldValue.serverTimestamp(), decisionNote: note ?? null });
    tx.set(db.collection(Collections.auditLog).doc(), {
      adminId,
      action: `external_sale_fee.${decision}`,
      entityType: "artwork_penalty",
      entityId: penaltyId,
      entityLabel: null,
      detail: note ? { note } : null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}
