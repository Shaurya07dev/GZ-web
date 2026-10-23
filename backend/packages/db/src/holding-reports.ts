// Aggregator-raised reports on pieces they're holding (damaged, wrong piece,
// COA issue, etc). Written when the aggregator submits from the holding
// detail page; read by admins from the moderation board. Snapshot fields
// (artwork title, aggregator name, artist name) are stored so the admin list
// renders without joining four other collections for every row.

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  Collections,
  type HoldingReportDoc,
  type HoldingReportIssueType,
  type HoldingReportStatus,
  type AggregatorHoldingDoc,
  type ArtworkDoc,
  type UserDoc,
  type PublicProfileDoc,
} from "./collections.ts";
import { DbError } from "./errors.ts";

export class HoldingReportError extends DbError {}

export interface HoldingReportRow extends Omit<HoldingReportDoc, "reportedAt" | "resolvedAt"> {
  id: string;
  reportedAt: string;
  resolvedAt: string | null;
}

function toRow(id: string, d: HoldingReportDoc): HoldingReportRow {
  return {
    id,
    holdingId: d.holdingId,
    artworkId: d.artworkId,
    artworkTitle: d.artworkTitle,
    aggregatorId: d.aggregatorId,
    aggregatorName: d.aggregatorName,
    aggregatorEmail: d.aggregatorEmail,
    artistId: d.artistId,
    artistName: d.artistName,
    issueType: d.issueType,
    description: d.description,
    status: d.status,
    reportedAt: d.reportedAt.toDate().toISOString(),
    resolvedAt: d.resolvedAt?.toDate().toISOString() ?? null,
    resolvedBy: d.resolvedBy,
    resolutionNote: d.resolutionNote,
  };
}

export interface CreateHoldingReportInput {
  holdingId: string;
  aggregatorId: string;
  issueType: HoldingReportIssueType;
  description: string;
}

export async function createHoldingReport(db: Firestore, input: CreateHoldingReportInput): Promise<HoldingReportRow> {
  const holdingSnap = await db.collection(Collections.aggregatorHoldings).doc(input.holdingId).get();
  const holding = holdingSnap.data() as AggregatorHoldingDoc | undefined;
  if (!holding) throw new HoldingReportError(`No holding ${input.holdingId}`);
  if (holding.aggregatorId !== input.aggregatorId) throw new HoldingReportError("You can only report on a piece you're holding");

  const [artworkSnap, aggregatorSnap] = await Promise.all([
    db.collection(Collections.artworks).doc(holding.artworkId).get(),
    db.collection(Collections.users).doc(input.aggregatorId).get(),
  ]);
  const artwork = artworkSnap.data() as ArtworkDoc | undefined;
  const aggregator = aggregatorSnap.data() as UserDoc | undefined;
  if (!artwork || !aggregator) throw new HoldingReportError("Holding references a missing artwork or aggregator");

  const artistProfileSnap = await db.collection(Collections.publicProfiles).doc(artwork.artistId).get();
  const artistProfile = artistProfileSnap.data() as PublicProfileDoc | undefined;

  const doc: HoldingReportDoc = {
    holdingId: input.holdingId,
    artworkId: holding.artworkId,
    artworkTitle: artwork.title,
    aggregatorId: input.aggregatorId,
    aggregatorName: aggregator.name,
    aggregatorEmail: aggregator.email,
    artistId: artwork.artistId,
    artistName: artistProfile?.name ?? "Unknown artist",
    issueType: input.issueType,
    description: input.description,
    status: "open",
    reportedAt: Timestamp.now(),
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
  };

  const ref = await db.collection(Collections.holdingReports).add(doc);
  return toRow(ref.id, doc);
}

/** Admin: every report, newest first. Open ones bubble to the top. */
export async function listHoldingReports(db: Firestore, filter?: { status?: HoldingReportStatus }): Promise<HoldingReportRow[]> {
  let q = db.collection(Collections.holdingReports).orderBy("reportedAt", "desc");
  if (filter?.status) q = q.where("status", "==", filter.status) as typeof q;
  const snap = await q.get();
  return snap.docs.map((d) => toRow(d.id, d.data() as HoldingReportDoc));
}

export interface ResolveHoldingReportInput {
  reportId: string;
  adminId: string;
  note?: string | null;
}

export async function resolveHoldingReport(db: Firestore, input: ResolveHoldingReportInput): Promise<HoldingReportRow> {
  const ref = db.collection(Collections.holdingReports).doc(input.reportId);
  const snap = await ref.get();
  const existing = snap.data() as HoldingReportDoc | undefined;
  if (!existing) throw new HoldingReportError(`No report ${input.reportId}`);
  if (existing.status === "resolved") return toRow(input.reportId, existing);

  const patch: Partial<HoldingReportDoc> = {
    status: "resolved",
    resolvedAt: Timestamp.now(),
    resolvedBy: input.adminId,
    resolutionNote: input.note ?? null,
  };
  await ref.update(patch);
  return toRow(input.reportId, { ...existing, ...patch } as HoldingReportDoc);
}
