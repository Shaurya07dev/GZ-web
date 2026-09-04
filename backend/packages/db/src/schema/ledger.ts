// Double-entry, append-only ledger — plan.md §6.5. Every money movement in
// the system (checkout, artist settlement, aggregator advance/commission,
// refund, withdrawal payout) is one or more ledger_entries rows whose
// amounts sum to zero across the entry set for a given transactionId. The
// balance-sums-to-zero rule is enforced by a DB trigger (not written here —
// belongs in the migration, not the Drizzle schema file, since it's plain
// SQL) so it holds even against a bug in application code, not just a
// passing test.

import { bigint, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./identity.ts";
import { orders } from "./order.ts";
import { aggregatorHoldings } from "./aggregator.ts";

// A ledger account belongs to exactly one of: a user's payout-pending
// balance, GalleryZone's own revenue account, an escrow/Razorpay Route
// clearing account, or a fixed system account (GST payable, TDS payable).
// Kept as free-form `ownerType`/`ownerId` rather than a foreign key to
// `users` so system accounts (no owning user) fit the same table.
export const ledgerAccountTypeValues = [
  "artist_payable",
  "aggregator_payable", // read-only balance view per plan.md §3.4 — aggregator is agent, not principal, never a real wallet
  "customer_wallet",
  "platform_revenue",
  "razorpay_escrow",
  "gst_payable",
  "tds_payable",
] as const;
export type LedgerAccountType = (typeof ledgerAccountTypeValues)[number];

export const ledgerAccounts = pgTable("ledger_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 32 }).notNull().$type<LedgerAccountType>(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "restrict" }), // null for a system account
}, (table) => [index("ledger_accounts_owner_id_idx").on(table.ownerId)]);

// Append-only. No UPDATE/DELETE grant for the app's DB role (Security
// posture section) — a correction is a new, opposite-signed entry with the
// same transactionId, same as standard double-entry bookkeeping practice,
// never an edit to a posted row.
export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Groups every entry produced by one business event (e.g. one order's
  // checkout capture) — the set of entries sharing a transactionId is what
  // the balance-sums-to-zero trigger checks.
  transactionId: uuid("transaction_id").notNull(),
  accountId: uuid("account_id").notNull().references(() => ledgerAccounts.id, { onDelete: "restrict" }),
  // Signed paise. Positive = credit to the account, negative = debit.
  amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  reason: text("reason").notNull(), // e.g. "marketplace_settlement", "aggregator_advance", "refund"
  relatedOrderId: uuid("related_order_id").references(() => orders.id, { onDelete: "restrict" }),
  relatedHoldingId: uuid("related_holding_id").references(() => aggregatorHoldings.id, { onDelete: "restrict" }),
  idempotencyKey: text("idempotency_key").notNull().unique(), // UNIQUE at the migration level
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // The balance-sums-to-zero trigger's own query pattern, and every
  // "show me this transaction's postings" read.
  index("ledger_entries_transaction_id_idx").on(table.transactionId),
  index("ledger_entries_account_id_idx").on(table.accountId),
]);

// Read model over ledger_entries for the admin settlements queue
// (adminService.listSettlements/retrySettlement) and artist/aggregator
// wallet screens — a settlement is a business-meaningful grouping of ledger
// entries, not a new source of truth.
export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "restrict" }),
  holdingId: uuid("holding_id").references(() => aggregatorHoldings.id, { onDelete: "restrict" }), // aggregator-channel sale
  artistId: uuid("artist_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  artistAmountPaise: bigint("artist_amount_paise", { mode: "number" }).notNull(),
  aggregatorCommissionPaise: bigint("aggregator_commission_paise", { mode: "number" }),
  platformRevenuePaise: bigint("platform_revenue_paise", { mode: "number" }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  releaseAfter: timestamp("release_after", { withTimezone: true }).notNull(), // payoutReleaseDate()
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => [
  index("settlements_artist_id_idx").on(table.artistId),
  index("settlements_status_idx").on(table.status),
]);

export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => [
  index("withdrawal_requests_user_id_idx").on(table.userId),
  index("withdrawal_requests_status_idx").on(table.status),
]);
