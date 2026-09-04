// Reference implementation of packages/config's RateConfigStore interface,
// backed by a plain in-memory array instead of Postgres. Two jobs:
//
//   1. It's what local dev / apps/api unit tests use before a real
//      Postgres-backed implementation exists (Phase 1) — same interface,
//      swap-in-place, no test double needs rewriting later.
//   2. It's the executable spec for the two-step propose/approve rule the
//      plan's Admin rules console describes: this is where "an unapproved
//      row is never read by loadActiveRates() regardless of its
//      effectiveFrom" and "a change cannot be self-approved by its
//      proposer" actually get enforced and testable today, without waiting
//      on drizzle-orm/Postgres access.

import type { RateConfigStore, RateConfigVersion } from "@galleryzone/config";
import type { PricingRates } from "@galleryzone/domain";

interface StoredVersion {
  id: string;
  rates: PricingRates;
  effectiveFrom: Date;
  proposedBy: string;
  reason: string;
  approvedBy: string | null;
  approvedAt: Date | null;
}

export class InMemoryRateConfigStore implements RateConfigStore {
  private versions: StoredVersion[] = [];

  propose({
    rates,
    effectiveFrom,
    proposedBy,
    reason,
  }: {
    rates: PricingRates;
    effectiveFrom: Date;
    proposedBy: string;
    reason: string;
  }): string {
    const id = `rate-config-${this.versions.length + 1}`;
    this.versions.push({ id, rates, effectiveFrom, proposedBy, reason, approvedBy: null, approvedAt: null });
    return id;
  }

  approve({ versionId, approvedBy }: { versionId: string; approvedBy: string }): void {
    const version = this.versions.find((v) => v.id === versionId);
    if (!version) throw new Error(`No rate_config version ${versionId}`);
    if (version.approvedBy) throw new Error(`${versionId} is already approved`);
    if (version.proposedBy === approvedBy) {
      throw new Error("A rate change cannot be self-approved by its proposer");
    }
    version.approvedBy = approvedBy;
    version.approvedAt = new Date();
  }

  async getActiveVersion(asOf: Date): Promise<RateConfigVersion | null> {
    const candidates = this.versions
      .filter((v) => v.approvedBy !== null && v.effectiveFrom.getTime() <= asOf.getTime())
      .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
    const top = candidates[0];
    if (!top || !top.approvedBy) return null;
    return { id: top.id, effectiveFrom: top.effectiveFrom, rates: top.rates, approvedBy: top.approvedBy, reason: top.reason };
  }
}
