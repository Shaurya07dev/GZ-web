// Artist account deactivation requests + external-sale penalty decisions —
// both simple admin queues over existing tables
// (deactivation_requests doesn't exist yet as its own table in the
// schema; modeled here directly against users.status since a deactivation
// IS a status change, not a separate entity — the request/decision
// trail is what audit_log already captures).

import { eq } from "drizzle-orm";
import { deactivationStateMachine, penaltyStateMachine, type DeactivationStatus, type PenaltyStatus } from "@galleryzone/domain";
import type { Db } from "./client.ts";
import { users } from "./schema/identity.ts";
import { externalSalePenalties } from "./schema/artwork.ts";
import { auditLog } from "./schema/audit.ts";

export class DeactivationError extends Error {}

// Deactivation requests are tracked as audit_log rows keyed by the user —
// there's no dedicated table (the plan's schema didn't carve one out, and
// the request/decision IS an audit event); status lives in an in-memory
// derivation of the latest "deactivation.requested"/"deactivation.approved"/
// "deactivation.rejected"/"deactivation.withdrawn" audit_log row per user.
async function latestDeactivationStatus(db: Db, userId: string): Promise<DeactivationStatus | "none"> {
  const rows = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(eq(auditLog.entityId, userId));
  const deactivationRows = rows.filter((r) => r.action.startsWith("deactivation."));
  const latest = deactivationRows[deactivationRows.length - 1];
  if (!latest) return "none";
  if (latest.action === "deactivation.requested") return "pending";
  if (latest.action === "deactivation.approved") return "approved";
  if (latest.action === "deactivation.rejected") return "rejected";
  return "none";
}

export async function requestDeactivation(db: Db, userId: string, reason: string): Promise<void> {
  const current = await latestDeactivationStatus(db, userId);
  if (current === "pending") throw new DeactivationError("A deactivation request is already pending");
  await db.insert(auditLog).values({ adminId: userId, action: "deactivation.requested", entityType: "user", entityId: userId, detail: { reason } });
}

export async function decideDeactivation(db: Db, userId: string, adminId: string, decision: "approved" | "rejected", note?: string): Promise<void> {
  const current = await latestDeactivationStatus(db, userId);
  if (current === "none") throw new DeactivationError("No deactivation request to decide");
  deactivationStateMachine.assertTransition(current as DeactivationStatus, decision);

  await db.transaction(async (tx) => {
    if (decision === "approved") {
      await tx.update(users).set({ status: "suspended" }).where(eq(users.id, userId));
    }
    await tx.insert(auditLog).values({ adminId, action: `deactivation.${decision}`, entityType: "user", entityId: userId, detail: note ? { note } : null });
  });
}

// --- External-sale penalties -------------------------------------------------

export async function listExternalSaleFees(db: Db) {
  return db.select().from(externalSalePenalties);
}

export async function decideExternalSaleFee(db: Db, penaltyId: string, adminId: string, decision: Exclude<PenaltyStatus, "pending_review">, note?: string): Promise<void> {
  const [penalty] = await db.select({ status: externalSalePenalties.status }).from(externalSalePenalties).where(eq(externalSalePenalties.id, penaltyId));
  if (!penalty) throw new DeactivationError(`No penalty ${penaltyId}`);
  penaltyStateMachine.assertTransition(penalty.status, decision);

  await db.transaction(async (tx) => {
    await tx.update(externalSalePenalties).set({ status: decision, decidedAt: new Date(), decisionNote: note ?? null }).where(eq(externalSalePenalties.id, penaltyId));
    await tx.insert(auditLog).values({ adminId, action: `external_sale_fee.${decision}`, entityType: "artwork_penalty", entityId: penaltyId, detail: note ? { note } : null });
  });
}
