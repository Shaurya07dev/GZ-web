// Postgres-backed RateConfigStore — the real implementation the plan's
// Admin rules console describes, replacing InMemoryRateConfigStore once
// apps/api has a live database connection. Same interface
// (@galleryzone/config's RateConfigStore), same two-step propose/approve
// semantics, verified in rate-config-store.check.ts against a real
// Postgres 16 — not just type-checked.

import { and, desc, eq, isNotNull, lte } from "drizzle-orm";
import type { RateConfigStore, RateConfigVersion } from "@galleryzone/config";
import type { PricingRates } from "@galleryzone/domain";
import type { Db } from "../client.ts";
import { rateConfigVersions } from "../schema/rate-config.ts";

export class PostgresRateConfigStore implements RateConfigStore {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async propose({
    rates,
    effectiveFrom,
    proposedBy,
    reason,
  }: {
    rates: PricingRates;
    effectiveFrom: Date;
    proposedBy: string;
    reason: string;
  }): Promise<string> {
    const [row] = await this.db
      .insert(rateConfigVersions)
      .values({ rates, effectiveFrom, proposedBy, reason })
      .returning({ id: rateConfigVersions.id });
    if (!row) throw new Error("insert into rate_config_versions returned no row");
    return row.id;
  }

  async approve({ versionId, approvedBy }: { versionId: string; approvedBy: string }): Promise<void> {
    const [existing] = await this.db
      .select({ proposedBy: rateConfigVersions.proposedBy, approvedBy: rateConfigVersions.approvedBy })
      .from(rateConfigVersions)
      .where(eq(rateConfigVersions.id, versionId));

    if (!existing) throw new Error(`No rate_config_versions row ${versionId}`);
    if (existing.approvedBy) throw new Error(`${versionId} is already approved`);
    if (existing.proposedBy === approvedBy) {
      throw new Error("A rate change cannot be self-approved by its proposer");
    }

    // rate_config_versions has no UPDATE grant for the app role once
    // Phase 0's gz_app role exists (see migrations/0001's commented
    // REVOKE block) — approving is the ONE sanctioned exception to
    // append-only on this table, since it's completing a two-step write
    // of the same logical event, not correcting a posted one. If that
    // policy changes, this becomes an insert-a-new-row-and-supersede
    // pattern instead, matching every other append-only table.
    await this.db
      .update(rateConfigVersions)
      .set({ approvedBy, approvedAt: new Date() })
      .where(eq(rateConfigVersions.id, versionId));
  }

  async getActiveVersion(asOf: Date): Promise<RateConfigVersion | null> {
    const [row] = await this.db
      .select()
      .from(rateConfigVersions)
      .where(and(isNotNull(rateConfigVersions.approvedBy), lte(rateConfigVersions.effectiveFrom, asOf)))
      .orderBy(desc(rateConfigVersions.effectiveFrom))
      .limit(1);

    if (!row || !row.approvedBy) return null;
    return {
      id: row.id,
      effectiveFrom: row.effectiveFrom,
      rates: row.rates as PricingRates,
      approvedBy: row.approvedBy,
      reason: row.reason,
    };
  }
}
