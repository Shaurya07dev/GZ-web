// Orders and money — plan.md §6.4. Money stored as BIGINT paise throughout
// (plan.md §18) — never a float, never rupees. Order.status is driven
// exclusively through packages/domain's orderStateMachine; this table only
// ever reflects a transition that already passed assertTransition().

import { bigint, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import type { OrderStatus } from "@galleryzone/domain";
import { users, addresses } from "./identity.ts";
import { artworks } from "./artwork.ts";
import { rateConfigVersions } from "./rate-config.ts";

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "restrict" }),
  customerId: uuid("customer_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  addressId: uuid("address_id").notNull().references(() => addresses.id, { onDelete: "restrict" }),

  displayPricePaise: bigint("display_price_paise", { mode: "number" }).notNull(),
  gstPaise: bigint("gst_paise", { mode: "number" }).notNull(),
  deliveryChargePaise: bigint("delivery_charge_paise", { mode: "number" }).notNull(),
  convenienceFeePaise: bigint("convenience_fee_paise", { mode: "number" }).notNull(),
  totalPaise: bigint("total_paise", { mode: "number" }).notNull(),

  status: varchar("status", { length: 16 }).notNull().default("pending").$type<OrderStatus>(),

  // Which rate_config_versions row priced this order — settlement/GST math
  // for this order always replays against THIS version, even if rates
  // change later (see the plan's Admin rules console: "live orders/
  // settlements always read the version that was active at transaction
  // time").
  rateConfigVersionId: uuid("rate_config_version_id").notNull().references(() => rateConfigVersions.id, { onDelete: "restrict" }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only, mirrors artwork_status_events' shape for the same reason.
export const orderStatusEvents = pgTable("order_status_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 16 }).notNull().$type<OrderStatus>(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

// Razorpay Route payment record — one row per capture attempt. Real
// gateway integration is Phase 2 (needs Razorpay onboarding, see the
// plan's "things needed from you" #7); this table exists now so Order can
// reference it without a later migration reshaping the FK.
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  provider: text("provider").notNull().default("razorpay"),
  providerPaymentId: text("provider_payment_id"),
  method: text("method"),
  amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  // Idempotency at the DB unique-constraint level (plan.md §17 gate) — a
  // webhook replayed 3x must produce exactly one row here, enforced by a
  // UNIQUE index on this column at the migration level, not just app code.
  idempotencyKey: text("idempotency_key").notNull().unique(),
  status: text("status").notNull(),
  rawWebhookPayload: jsonb("raw_webhook_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
