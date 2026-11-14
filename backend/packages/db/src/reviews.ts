// Who decided what, for the admin queues' "Reviewed by" column.
//
// Every admin decision (GST, KYC, deactivation, external-sale fee) already writes an audit-log row with the
// admin's id, the action ("gst.approved") and the time, so the answer is read from there: nothing new is
// stored and older decisions are covered too.
//
// ponytail: one audit-log read per queue request, filtered by action. Fine for the number of decisions an
// admin team makes; index the rows by entity (or copy the reviewer onto the record) if it ever gets large.

import type { Firestore } from "firebase-admin/firestore";
import { Collections, type AuditLogDoc } from "./collections.ts";

export interface ReviewStamp {
  adminName: string;
  /** "approved", "rejected", "waived": the last word of the audit action. */
  decision: string;
  /** ISO time of the decision. */
  at: string;
}

/** "gst.approved" gives "approved". */
export const decisionOf = (action: string): string => action.slice(action.lastIndexOf(".") + 1);

/** The newest row for each entity. Pure. */
export function latestPerEntity<T extends { entityId: string; at: number }>(rows: T[]): Map<string, T> {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const current = latest.get(row.entityId);
    if (!current || row.at >= current.at) latest.set(row.entityId, row);
  }
  return latest;
}

/** uid to display name, for the admins who decided. Missing users are left out. */
export async function adminNames(db: Firestore, adminIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(adminIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const snaps = await db.getAll(...ids.map((id) => db.collection(Collections.users).doc(id)));
  const names = new Map<string, string>();
  for (const snap of snaps) {
    const name = (snap.data() as { name?: string } | undefined)?.name?.trim();
    if (name) names.set(snap.id, name);
  }
  return names;
}

/** The latest decision on each entity among the given audit actions (at most 30). */
export async function loadReviews(db: Firestore, actions: string[]): Promise<Map<string, ReviewStamp>> {
  if (actions.length === 0) return new Map();
  const snap = await db.collection(Collections.auditLog).where("action", "in", actions).get();
  const rows = snap.docs.map((d) => {
    const row = d.data() as AuditLogDoc;
    return { adminId: row.adminId, action: row.action, entityId: row.entityId, at: row.createdAt?.toMillis() ?? 0 };
  });
  const latest = latestPerEntity(rows);
  const names = await adminNames(db, [...latest.values()].map((r) => r.adminId));
  const stamps = new Map<string, ReviewStamp>();
  for (const [entityId, row] of latest) {
    stamps.set(entityId, { adminName: names.get(row.adminId) ?? "An admin", decision: decisionOf(row.action), at: new Date(row.at).toISOString() });
  }
  return stamps;
}
