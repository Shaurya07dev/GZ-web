// Trust/disputes/audit — plan.md §6.6. Same-transaction write: every admin
// decision (approve/reject KYC, GST, insurance, withdrawal, rate change,
// artwork moderation) writes its audit_log row in the same DB transaction
// as the decision itself, never as a fire-and-forget afterthought — so an
// audit gap can never exist for a real decision.

import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity.ts";
import { orders } from "./order.ts";
import { artworks } from "./artwork.ts";

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  action: text("action").notNull(), // matches frontend-web/types/admin.ts's AuditAction union
  entityType: text("entity_type").notNull(),
  // Polymorphic (points at whichever table entityType names) — cannot be a
  // real FK, and shouldn't be: an audit log entry must survive even if the
  // entity it describes is later deleted.
  entityId: uuid("entity_id").notNull(),
  entityLabel: text("entity_label"),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // "Show me this entity's audit history" — the polymorphic pair together.
  index("audit_log_entity_type_entity_id_idx").on(table.entityType, table.entityId),
  index("audit_log_admin_id_idx").on(table.adminId),
]);

export const disputes = pgTable("disputes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "restrict" }),
  artworkId: uuid("artwork_id").references(() => artworks.id, { onDelete: "restrict" }),
  raisedByUserId: uuid("raised_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNote: text("resolution_note"),
}, (table) => [index("disputes_status_idx").on(table.status)]);
