// Admin moderation decisions — KYC, GST, insurance. Every decision writes
// its audit_log row in the SAME DB transaction as the status change itself
// (plan.md §6.6: "so an audit gap can never exist for a real decision"),
// and every transition goes through packages/domain's review-queue state
// machines first — an illegal decision (e.g. approving something already
// approved) throws before either write happens.

import { eq } from "drizzle-orm";
import { gstStateMachine, insuranceStateMachine, kycStateMachine, type ReviewStatus } from "@galleryzone/domain";
import type { Db } from "./client.ts";
import { profiles } from "./schema/identity.ts";
import { artworks } from "./schema/artwork.ts";
import { auditLog } from "./schema/audit.ts";

export class ModerationError extends Error {}

interface DecisionInput {
  db: Db;
  adminId: string;
  decision: "approved" | "rejected";
  reason?: string | undefined;
}

function requireReasonIfRejected(decision: "approved" | "rejected", reason: string | undefined): void {
  if (decision === "rejected" && !reason) {
    throw new ModerationError("A rejection requires a reason");
  }
}

export async function decideGst(input: DecisionInput & { userId: string }): Promise<void> {
  requireReasonIfRejected(input.decision, input.reason);
  const [profile] = await input.db.select({ gstStatus: profiles.gstStatus }).from(profiles).where(eq(profiles.userId, input.userId));
  if (!profile) throw new ModerationError(`No profile for user ${input.userId}`);
  const current = (profile.gstStatus ?? "not_submitted") as ReviewStatus;
  gstStateMachine.assertTransition(current, input.decision);

  await input.db.transaction(async (tx) => {
    await tx.update(profiles).set({ gstStatus: input.decision }).where(eq(profiles.userId, input.userId));
    await tx.insert(auditLog).values({
      adminId: input.adminId,
      action: input.decision === "approved" ? "gst.approved" : "gst.rejected",
      entityType: "user",
      entityId: input.userId,
      detail: input.reason ? { reason: input.reason } : null,
    });
  });
}

export async function decideKyc(input: DecisionInput & { userId: string }): Promise<void> {
  requireReasonIfRejected(input.decision, input.reason);
  const [profile] = await input.db.select({ aadhaarStatus: profiles.aadhaarStatus }).from(profiles).where(eq(profiles.userId, input.userId));
  if (!profile) throw new ModerationError(`No profile for user ${input.userId}`);
  const current = (profile.aadhaarStatus ?? "not_submitted") as ReviewStatus;
  kycStateMachine.assertTransition(current, input.decision);

  await input.db.transaction(async (tx) => {
    await tx.update(profiles).set({ aadhaarStatus: input.decision }).where(eq(profiles.userId, input.userId));
    await tx.insert(auditLog).values({
      adminId: input.adminId,
      action: input.decision === "approved" ? "kyc.approved" : "kyc.rejected",
      entityType: "user",
      entityId: input.userId,
      detail: input.reason ? { reason: input.reason } : null,
    });
  });
}

export async function decideInsurance(input: DecisionInput & { artworkId: string }): Promise<void> {
  requireReasonIfRejected(input.decision, input.reason);
  const [artwork] = await input.db.select({ insuranceStatus: artworks.insuranceStatus }).from(artworks).where(eq(artworks.id, input.artworkId));
  if (!artwork) throw new ModerationError(`No artwork ${input.artworkId}`);
  const current = (artwork.insuranceStatus ?? "not_submitted") as ReviewStatus;
  insuranceStateMachine.assertTransition(current, input.decision);

  await input.db.transaction(async (tx) => {
    await tx.update(artworks).set({ insuranceStatus: input.decision }).where(eq(artworks.id, input.artworkId));
    await tx.insert(auditLog).values({
      adminId: input.adminId,
      action: input.decision === "approved" ? "insurance.approved" : "insurance.rejected",
      entityType: "artwork",
      entityId: input.artworkId,
      detail: input.reason ? { reason: input.reason } : null,
    });
  });
}
