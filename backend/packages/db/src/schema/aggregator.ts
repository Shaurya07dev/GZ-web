// Consignment/aggregator — plan.md §6.3. Holding rows are never deleted
// (returned rows are kept for cycle-month counting, matching the mock
// frontend's own comment on this exact point) — status transitions only,
// via packages/domain's holdingStateMachine.

import { bigint, boolean, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import type { HoldingStatus, ShipmentStatus } from "@galleryzone/domain";
import { users } from "./identity.ts";
import { artworks } from "./artwork.ts";

export const gallerySpaces = pgTable("gallery_spaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  aggregatorId: uuid("aggregator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  addressLine1: text("address_line1").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  capacity: integer("capacity"),
  coordinatorName: text("coordinator_name"),
});

export const aggregatorHoldings = pgTable("aggregator_holdings", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "restrict" }),
  aggregatorId: uuid("aggregator_id").notNull().references(() => users.id, { onDelete: "restrict" }),

  cycleMonth: integer("cycle_month").notNull(), // 1..aggregatorCycleMonths
  advancePercent: integer("advance_percent").notNull(), // basis points would be more precise; kept as whole percent to match the frontend's own 5|3 union
  advanceAmountPaise: bigint("advance_amount_paise", { mode: "number" }).notNull(),
  deliveryDepositPaise: bigint("delivery_deposit_paise", { mode: "number" }),
  displayPricePaise: bigint("display_price_paise", { mode: "number" }).notNull(),

  assignmentSource: varchar("assignment_source", { length: 16 }).notNull(), // "self_reserved" | "gz_assigned"
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // placementWindow().expiresAt
  windowExtended: boolean("window_extended").notNull().default(false),

  status: varchar("status", { length: 32 }).notNull().default("reserved").$type<HoldingStatus>(),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
});

export const aggregatorSales = pgTable("aggregator_sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  holdingId: uuid("holding_id").notNull().references(() => aggregatorHoldings.id, { onDelete: "restrict" }),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "restrict" }),

  soldPricePaise: bigint("sold_price_paise", { mode: "number" }).notNull(),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerPhone: text("buyer_phone"),
  deliveryAddress: text("delivery_address"), // freeform, or FK once buyer accounts exist via buyer_invites

  deliveryMode: varchar("delivery_mode", { length: 16 }).notNull(), // "courier" | "self_pickup"
  // Settled rule (25 Aug 2026, both frontends): on a cash sale the
  // aggregator owes GalleryZone the FULL sale price, not sale-minus-
  // commission — commission settles separately. remittedAt is null until
  // that full-price remittance is confirmed.
  paymentRoute: varchar("payment_route", { length: 32 }).notNull(), // "direct_to_galleryzone" | "cash_at_premises"
  remittedAt: timestamp("remitted_at", { withTimezone: true }),

  shipmentStatus: varchar("shipment_status", { length: 16 }).notNull().default("preparing").$type<ShipmentStatus>(),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  courierRef: text("courier_ref"),

  soldAt: timestamp("sold_at", { withTimezone: true }).notNull().defaultNow(),
});

// Bridges a walk-in aggregator-sale buyer (no account yet) to a real
// customer account by email, matching buyerInviteService.claimForEmail —
// run at registration so a first-time buyer's aggregator purchase shows up
// in their collection once they sign up.
export const buyerInvites = pgTable("buyer_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "restrict" }),
  soldPricePaise: bigint("sold_price_paise", { mode: "number" }).notNull(),
  soldAt: timestamp("sold_at", { withTimezone: true }).notNull(),
  source: text("source").notNull().default("aggregator_sale"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
});
