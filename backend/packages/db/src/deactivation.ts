// Artist account deactivation requests + external-sale penalty decisions —
// Firestore version. Deactivation status is still tracked as auditLog
// docs keyed by user (no dedicated collection — the request/decision IS
// the audit event, same reasoning as the Postgres version).

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { deactivationStateMachine, penaltyStateMachine, type DeactivationStatus, type PenaltyStatus } from "@galleryzone/domain";
import { Collections, type AuditLogDoc, type ExternalSalePenaltyDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class DeactivationError extends DbError {}

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

export interface ExternalSaleFeeView {
  id: string;
  artworkId: string;
  artworkTitle: string;
  artistId: string;
  artistName: string;
  amountPaise: number;
  status: PenaltyStatus;
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  settledAt: string | null;
}

/** Every external-sale fee, pending first, with artwork + artist names joined. */
export async function listExternalSaleFees(db: Firestore): Promise<ExternalSaleFeeView[]> {
  const snap = await db.collection(Collections.externalSalePenalties).get();
  const rows = await Promise.all(
    snap.docs.map(async (d) => {
      const p = d.data() as ExternalSalePenaltyDoc;
      const artwork = (await db.collection(Collections.artworks).doc(p.artworkId).get()).data() as { title?: string; artistId?: string; listing?: { artistName?: string } } | undefined;
      return {
        id: d.id,
        artworkId: p.artworkId,
        artworkTitle: artwork?.title ?? p.artworkId,
        artistId: artwork?.artistId ?? "",
        artistName: artwork?.listing?.artistName ?? "",
        amountPaise: p.amountPaise,
        status: p.status,
        createdAt: p.createdAt?.toDate().toISOString() ?? new Date(0).toISOString(),
        decidedAt: p.decidedAt?.toDate().toISOString() ?? null,
        decisionNote: p.decisionNote,
        settledAt: p.settledAt?.toDate().toISOString() ?? null,
      };
    }),
  );
  const rank = (s: string) => (s === "pending_review" ? 0 : 1);
  return rows.sort((a, b) => rank(a.status) - rank(b.status) || b.createdAt.localeCompare(a.createdAt));
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

export interface DeactivationRequestView {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  status: DeactivationStatus;
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
}

/** Folds a user's deactivation audit rows into one request record (the latest cycle). */
function foldDeactivation(userId: string, userName: string, rows: (AuditLogDoc & { id: string })[]): DeactivationRequestView | null {
  const mine = rows.filter((r) => r.entityId === userId && r.action.startsWith("deactivation.")).sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
  const lastRequestIdx = mine.map((r) => r.action).lastIndexOf("deactivation.requested");
  if (lastRequestIdx < 0) return null;
  const request = mine[lastRequestIdx]!;
  const decision = mine.slice(lastRequestIdx + 1).find((r) => r.action === "deactivation.approved" || r.action === "deactivation.rejected");
  const detail = (request.detail ?? {}) as { reason?: string };
  const note = (decision?.detail ?? {}) as { note?: string };
  return {
    id: request.id,
    userId,
    userName,
    reason: detail.reason ?? "",
    status: decision ? (decision.action === "deactivation.approved" ? "approved" : "rejected") : "pending",
    requestedAt: request.createdAt?.toDate().toISOString() ?? new Date(0).toISOString(),
    decidedAt: decision?.createdAt?.toDate().toISOString() ?? null,
    decisionNote: note.note ?? null,
  };
}

export async function getDeactivationRequest(db: Firestore, userId: string): Promise<DeactivationRequestView | null> {
  const [snap, userSnap] = await Promise.all([
    db.collection(Collections.auditLog).where("entityId", "==", userId).orderBy("createdAt").get(),
    db.collection(Collections.users).doc(userId).get(),
  ]);
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as AuditLogDoc) }));
  return foldDeactivation(userId, (userSnap.data() as { name?: string } | undefined)?.name ?? userId, rows);
}

/** Every user with a deactivation cycle on record, pending first. */
export async function listDeactivationRequests(db: Firestore): Promise<DeactivationRequestView[]> {
  const snap = await db.collection(Collections.auditLog).where("entityType", "==", "user").orderBy("createdAt").get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as AuditLogDoc) })).filter((r) => r.action.startsWith("deactivation."));
  const userIds = [...new Set(rows.map((r) => r.entityId))];
  const users = await Promise.all(userIds.map((id) => db.collection(Collections.users).doc(id).get()));
  const out: DeactivationRequestView[] = [];
  userIds.forEach((id, i) => {
    const v = foldDeactivation(id, (users[i]!.data() as { name?: string } | undefined)?.name ?? id, rows);
    if (v) out.push(v);
  });
  const rank = (s: string) => (s === "pending" ? 0 : 1);
  return out.sort((a, b) => rank(a.status) - rank(b.status) || b.requestedAt.localeCompare(a.requestedAt));
}
