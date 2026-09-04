// Artwork/provenance — plan.md §6.2. Append-only status/ownership event
// logs, per the Security posture section (no UPDATE/DELETE grant on these
// two tables for the app's DB role) — the *current* status/owner is always
// derived by reading the latest event, never stored as a mutable field that
// could silently disagree with its own history.

import { bigint, boolean, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import type { ArtworkStatus } from "@galleryzone/domain";

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
  productCode: varchar("product_code", { length: 16 }).notNull(), // GZ000001
  artistId: uuid("artist_id").notNull(),

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
  insuranceStatus: varchar("insurance_status", { length: 16 }),

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
});

export const artworkImages = pgTable("artwork_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").notNull().default(0),
  // GCS object path this was derived from — lets the image-derivative job
  // (plan.md §13) regenerate thumbnailUrl without re-deriving from url.
  storagePath: text("storage_path").notNull(),
});

// Append-only. current status = the latest row for an artworkId, ordered by
// changedAt. Every write goes through artworkStateMachine.assertTransition
// first (packages/domain) — this table is the event log that transition
// produces, not a place transitions are decided.
export const artworkStatusEvents = pgTable("artwork_status_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull(),
  status: varchar("status", { length: 32 }).notNull().$type<ArtworkStatus>(),
  changedBy: uuid("changed_by"), // null for a system/job-driven transition
  reason: text("reason"), // required by convention for a rejection; optional otherwise
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only legal ownership chain — plan.md §3.2/§6.2. Distinct from
// artwork_status_events: status is operational (where the piece is in the
// sales pipeline), ownership is legal (who holds title). A "display
// transfer" (time-boxed, per ownershipService's `kind: "display"`) writes
// here too but with a displayEndsAt, and does NOT change legal custody.
export const ownershipEvents = pgTable("ownership_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull(),
  kind: varchar("kind", { length: 16 }).notNull(), // "ownership" | "display"
  fromUserId: uuid("from_user_id"),
  toUserId: uuid("to_user_id"),
  toEmail: text("to_email"), // recipient may not have an account yet
  initiatedAt: timestamp("initiated_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  displayEndsAt: timestamp("display_ends_at", { withTimezone: true }),
  displayEndedAt: timestamp("display_ended_at", { withTimezone: true }),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
});

export const externalSalePenalties = pgTable("external_sale_penalties", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull(),
  amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending_review"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionNote: text("decision_note"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
});

export const physicalCoaRequests = pgTable("physical_coa_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull(),
  requestedByUserId: uuid("requested_by_user_id").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  deliveryLine1: text("delivery_line1").notNull(),
  deliveryCity: text("delivery_city").notNull(),
  deliveryState: text("delivery_state").notNull(),
  deliveryPincode: text("delivery_pincode").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("requested"),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  courierRef: text("courier_ref"),
});
