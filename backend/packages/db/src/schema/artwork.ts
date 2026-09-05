// Artwork/provenance — plan.md §6.2. Append-only status/ownership event
// logs, per the Security posture section (no UPDATE/DELETE grant on these
// two tables for the app's DB role) — the *current* status/owner is always
// derived by reading the latest event, never stored as a mutable field that
// could silently disagree with its own history.

import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import type { ArtworkStatus, PenaltyStatus, ReviewStatus } from "@galleryzone/domain";
import { users } from "./identity.ts";

export const listingTypeValues = ["marketplace_only", "aggregator_only", "marketplace_and_aggregator"] as const;
export type ListingType = (typeof listingTypeValues)[number];

export const artworkRarityValues = ["R", "U", "O", "N"] as const;
export type ArtworkRarity = (typeof artworkRarityValues)[number];

// Product ID sequence, plan.md §3.1's AV000001 shape (naming updated from
// ArtVault to GalleryZone per the plan's Context section — prefix TBD with
// the client, defaulting to "GZ" here rather than carrying over the stale
// "AV" default).
export const artworks = pgTable("artworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  productCode: varchar("product_code", { length: 16 }).notNull().unique(), // GZ000001
  artistId: uuid("artist_id").notNull().references(() => users.id, { onDelete: "restrict" }),

  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  medium: text("medium").notNull(),
  dimensions: text("dimensions"),
  yearCreated: integer("year_created"),

  artworkType: text("artwork_type"),
  paintingStyle: text("painting_style"),

  // The single most security-sensitive column in the schema — plan.md §8.
  // Never serialized into a customer-facing DTO; the CI price-leak contract
  // test greps for exactly this shape of key name.
  artistPricePaise: bigint("artist_price_paise", { mode: "number" }).notNull(),

  listingType: varchar("listing_type", { length: 32 }).notNull().$type<ListingType>(),
  rarityType: varchar("rarity_type", { length: 1 }).$type<ArtworkRarity | null>(),

  coaCertificateNumber: text("coa_certificate_number"),
  coaIssueDate: timestamp("coa_issue_date", { withTimezone: true }),
  nfcTagId: text("nfc_tag_id"),

  insuranceNumber: text("insurance_number"),
  insuranceStatus: varchar("insurance_status", { length: 16 }).$type<ReviewStatus>(),

  weightKg: integer("weight_kg"),
  lengthCm: integer("length_cm"),
  breadthCm: integer("breadth_cm"),
  heightCm: integer("height_cm"),
  framing: varchar("framing", { length: 16 }),
  format: text("format"),
  hangingHardwareIncluded: boolean("hanging_hardware_included"),
  packagingConfirmed: boolean("packaging_confirmed"),

  socialProofLinks: jsonb("social_proof_links"), // [{platform, url}]

  // Artist edit window: 7 days from first listing OR until a
  // purchase-locked status is reached, whichever is first (see the
  // artwork state machine and artistDashboardService.updateArtwork's mock
  // rule). Recorded explicitly rather than derived from createdAt so a
  // re-list after being returned doesn't inherit the original clock.
  editableUntil: timestamp("editable_until", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Artist's own dashboard listing ("My Artworks") and admin's per-artist
  // catalogue view are both "WHERE artist_id = ?" — the plan's 10k-user
  // scale target flags exactly this as an unindexed full-table-scan risk.
  index("artworks_artist_id_idx").on(table.artistId),
  // Marketplace filters (category, listing type) are the highest-traffic
  // read path in the whole system.
  index("artworks_category_idx").on(table.category),
  index("artworks_listing_type_idx").on(table.listingType),
]);

export const artworkImages = pgTable("artwork_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").notNull().default(0),
  // GCS object path this was derived from — lets the image-derivative job
  // (plan.md §13) regenerate thumbnailUrl without re-deriving from url.
  storagePath: text("storage_path").notNull(),
}, (table) => [index("artwork_images_artwork_id_idx").on(table.artworkId)]);

// Append-only. current status = the latest row for an artworkId, ordered by
// changedAt. Every write goes through artworkStateMachine.assertTransition
// first (packages/domain) — this table is the event log that transition
// produces, not a place transitions are decided.
export const artworkStatusEvents = pgTable("artwork_status_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 32 }).notNull().$type<ArtworkStatus>(),
  changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }), // null for a system/job-driven transition
  reason: text("reason"), // required by convention for a rejection; optional otherwise
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // "Current status" is always read as the latest row for an artworkId —
  // this composite index is exactly that query's access path.
  index("artwork_status_events_artwork_id_changed_at_idx").on(table.artworkId, table.changedAt),
]);

// Append-only legal ownership chain — plan.md §3.2/§6.2. Distinct from
// artwork_status_events: status is operational (where the piece is in the
// sales pipeline), ownership is legal (who holds title). A "display
// transfer" (time-boxed, per ownershipService's `kind: "display"`) writes
// here too but with a displayEndsAt, and does NOT change legal custody.
export const ownershipEvents = pgTable("ownership_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "restrict" }),
  kind: varchar("kind", { length: 16 }).notNull(), // "ownership" | "display"
  fromUserId: uuid("from_user_id").references(() => users.id, { onDelete: "restrict" }),
  toUserId: uuid("to_user_id").references(() => users.id, { onDelete: "restrict" }),
  toEmail: text("to_email"), // recipient may not have an account yet
  initiatedAt: timestamp("initiated_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  displayEndsAt: timestamp("display_ends_at", { withTimezone: true }),
  displayEndedAt: timestamp("display_ended_at", { withTimezone: true }),
}, (table) => [index("ownership_events_artwork_id_idx").on(table.artworkId)]);

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const externalSalePenalties = pgTable("external_sale_penalties", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "restrict" }),
  amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending_review").$type<PenaltyStatus>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionNote: text("decision_note"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
}, (table) => [index("external_sale_penalties_artwork_id_idx").on(table.artworkId)]);

export const physicalCoaRequests = pgTable("physical_coa_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "restrict" }),
  requestedByUserId: uuid("requested_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  deliveryLine1: text("delivery_line1").notNull(),
  deliveryCity: text("delivery_city").notNull(),
  deliveryState: text("delivery_state").notNull(),
  deliveryPincode: text("delivery_pincode").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("requested"),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  courierRef: text("courier_ref"),
}, (table) => [index("physical_coa_requests_artwork_id_idx").on(table.artworkId)]);
