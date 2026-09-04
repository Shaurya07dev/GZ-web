// Trust/disputes/audit — plan.md §6.6. Same-transaction write: every admin
// decision (approve/reject KYC, GST, insurance, withdrawal, rate change,
// artwork moderation) writes its audit_log row in the same DB transaction
// as the decision itself, never as a fire-and-forget afterthought — so an
// audit gap can never exist for a real decision.

import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull(),
  action: text("action").notNull(), // matches frontend-web/types/admin.ts's AuditAction union
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  entityLabel: text("entity_label"),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disputes = pgTable("disputes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id"),
  artworkId: uuid("artwork_id"),
  raisedByUserId: uuid("raised_by_user_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNote: text("resolution_note"),
});
