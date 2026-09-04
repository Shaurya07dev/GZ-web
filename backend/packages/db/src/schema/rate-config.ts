// Drizzle schema for the versioned rate_config table — the concrete storage
// behind packages/config's RateConfigStore interface. This table is what
// makes every rate in packages/domain/src/pricing.ts a data value instead of
// a code constant, and what the admin rules console (see the plan) reads
// and writes.
//
// Requires `drizzle-orm` + `drizzle-kit` (added once `npm install` runs with
// network access — not run in this scaffolding pass). Left as real,
// buildable-once-installed source rather than a comment/pseudocode block,
// so Phase 1 has an actual migration to generate from, not a blank page.

import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// One row per approved rate change. Never UPDATEd or DELETEd (see the
// plan's Security posture section — no UPDATE/DELETE grant on this table
// for the application's DB role); a correction is a new row with a later
// effectiveFrom, same as every other append-only table in this schema
// (ledger_entries, ownership_events, artwork_status_events, audit_log).
export const rateConfigVersions = pgTable("rate_config_versions", {
  id: uuid("id").primaryKey().defaultRandom(),

  // The full PricingRates object (see packages/domain), stored as JSON so a
  // new rate can be added to the shape without a migration on every
  // deploy — the shape itself is still the TypeScript source of truth via
  // PricingRates, validated with the matching Zod schema in
  // packages/contracts before a write is accepted.
  rates: jsonb("rates").notNull(),

  // When this version becomes the active one. Settlements/orders always
  // read the version whose effectiveFrom is the latest one at or before
  // the transaction's own timestamp — so changing GST% today never
  // rewrites how yesterday's already-settled sale was taxed.
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),

  // Two-step change: proposedBy writes the row; approvedBy/approvedAt are
  // null until a second admin (narrower platform_admin/finance_admin role,
  // not general moderation admin) approves it. An unapproved row is never
  // read by loadActiveRates() regardless of its effectiveFrom.
  proposedBy: uuid("proposed_by").notNull(),
  proposedAt: timestamp("proposed_at", { withTimezone: true }).notNull().defaultNow(),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  // Required — same pattern as the existing RejectReasonDialog convention
  // in frontend-web's admin queues. Feeds the audit_log entry this write
  // also produces.
  reason: text("reason").notNull(),

  superseded: boolean("superseded").notNull().default(false),
});
