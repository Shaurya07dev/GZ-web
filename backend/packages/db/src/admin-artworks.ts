// Admin's all-artworks view + rarity ranking + delisting — Firestore
// version. The admin view legitimately includes artistPricePaise (plan.md
// §8: admin is one of the parties allowed to see it) — read from the
// pricing subcollection, same place firestore.rules gates it.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { artworkStateMachine } from "@galleryzone/domain";
import { appendArtworkStatus } from "./listing-projection.ts";
import {
  Collections,
  artworkPricingCol,
  artworkStatusEventsCol,
  type ArtworkDoc,
  type ArtworkPricingDoc,
  type ArtworkRarity,
  type ArtworkStatusEventDoc,
  type AuditLogDoc,
  artworkRarityValues,
} from "./collections.ts";
import { DbError } from "./errors.ts";

export class AdminArtworkError extends DbError {}

export interface AdminArtworkRow {
  id: string;
  productCode: string;
  artistId: string;
  title: string;
  category: string;
  artistPricePaise: number;
  rarityType: ArtworkRarity | null;
  status: string;
}

/** Every artwork carries a rank the admin chose, so a rank can be changed but never cleared. */
export async function setArtworkRarity(db: Firestore, artworkId: string, rarity: ArtworkRarity, adminId: string): Promise<void> {
  if (!(artworkRarityValues as readonly string[]).includes(rarity)) throw new AdminArtworkError(`Invalid rarity ${rarity}`);
  const ref = db.collection(Collections.artworks).doc(artworkId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AdminArtworkError(`No artwork ${artworkId}`);
    tx.update(ref, { rarityType: rarity });
    const auditDoc: AuditLogDoc = {
      adminId,
      action: "artwork.rarity_set",
      entityType: "artwork",
      entityId: artworkId,
      entityLabel: null,
      detail: { rarity },
      createdAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
    };
    tx.set(db.collection(Collections.auditLog).doc(), auditDoc);
  });
}

export async function delistArtwork(db: Firestore, artworkId: string, adminId: string): Promise<void> {
  const eventSnap = await db.collection(artworkStatusEventsCol(artworkId)).orderBy("changedAt", "desc").limit(1).get();
  const current = (eventSnap.docs[0]?.data() as ArtworkStatusEventDoc | undefined)?.status ?? "draft";
  artworkStateMachine.assertTransition(current, "returned");

  await appendArtworkStatus(db, artworkId, { status: "returned", changedBy: adminId, reason: "Delisted by admin" });
  await db.runTransaction(async (tx) => {
    tx.set(db.collection(Collections.auditLog).doc(), {
      adminId,
      action: "artwork.delisted",
      entityType: "artwork",
      entityId: artworkId,
      entityLabel: null,
      detail: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

export interface AuditLogView extends AuditLogDoc {
  id: string;
  /** Human-readable admin name joined at read time from users/{adminId}.name.
   *  Falls back to a short-form of the uid when the user doc is missing. */
  adminName: string;
  /** Human-readable subject name joined at read time from the right collection
   *  based on entityType ("user" → users, "artwork" → artworks.title, "order"
   *  → "Order <shortId>", etc.). Prefers the stored entityLabel when set. */
  subjectLabel: string;
}

/**
 * Admin audit log, enriched with human-readable names so the UI doesn't show
 * raw uids in the Subject and By columns (client flag 19 Nov 2026 — "what are
 * these random numbers"). Joins happen at read time in two batched passes:
 * one for admin names, one for subject names grouped by entityType. The audit
 * log is append-only and bounded (we load `limit` rows), so this stays well
 * under Firestore's 500-doc query limit for any realistic admin console view.
 */
export async function getAuditLog(db: Firestore, limit = 100): Promise<AuditLogView[]> {
  const snap = await db.collection(Collections.auditLog).orderBy("createdAt", "desc").limit(limit).get();
  const rows: Array<AuditLogDoc & { id: string }> = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as AuditLogDoc),
  }));

  // 1) Admin names — every entry has an adminId, dedup to a small set.
  const adminIds = Array.from(new Set(rows.map((r) => r.adminId).filter(Boolean)));
  const adminNames = await bulkLookupUserNames(db, adminIds);

  // 2) Subject names — collect ids per entityType, look them up in the right
  //    collection. User subjects use the same users lookup as admins (merged
  //    into one Firestore round-trip below).
  const userSubjectIds = rows.filter((r) => r.entityType === "user").map((r) => r.entityId);
  const artworkSubjectIds = rows.filter((r) => r.entityType === "artwork").map((r) => r.entityId);

  // Fold user subject lookups into the same batch as admin lookups — they all
  // land in the users collection, so one pass is cheaper than two.
  const extraUserIds = userSubjectIds.filter((id) => !adminNames.has(id));
  if (extraUserIds.length > 0) {
    const extras = await bulkLookupUserNames(db, Array.from(new Set(extraUserIds)));
    for (const [k, v] of extras) adminNames.set(k, v);
  }

  const artworkTitles = await bulkLookupArtworkTitles(db, Array.from(new Set(artworkSubjectIds)));

  return rows.map((row) => {
    const adminName = adminNames.get(row.adminId) ?? shortUid(row.adminId);
    let subjectLabel = row.entityLabel ?? "";
    if (!subjectLabel) {
      if (row.entityType === "user") {
        subjectLabel = adminNames.get(row.entityId) ?? shortUid(row.entityId);
      } else if (row.entityType === "artwork") {
        subjectLabel = artworkTitles.get(row.entityId) ?? shortUid(row.entityId);
      } else if (row.entityType === "order") {
        subjectLabel = `Order ${shortUid(row.entityId)}`;
      } else {
        subjectLabel = shortUid(row.entityId);
      }
    }
    return { ...row, adminName, subjectLabel };
  });
}

async function bulkLookupUserNames(db: Firestore, ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  // Firestore's getAll is up to 10x cheaper than N parallel .get()s for the
  // ~100 doc batch an audit page returns — no composite index needed.
  const refs = ids.map((id) => db.collection(Collections.users).doc(id));
  const snaps = await db.getAll(...refs);
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() as { name?: string; email?: string } | undefined;
    const label = data?.name?.trim() || data?.email || shortUid(snap.id);
    out.set(snap.id, label);
  }
  return out;
}

async function bulkLookupArtworkTitles(db: Firestore, ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const refs = ids.map((id) => db.collection(Collections.artworks).doc(id));
  const snaps = await db.getAll(...refs);
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() as { title?: string } | undefined;
    out.set(snap.id, data?.title ?? shortUid(snap.id));
  }
  return out;
}

/** "abcdef12…" — first 8 chars of a Firestore doc id, with an ellipsis so
 *  even the fallback reads as "an id, truncated for display" rather than a
 *  random run of characters. */
function shortUid(id: string): string {
  return id.length <= 8 ? id : `${id.slice(0, 8)}…`;
}
