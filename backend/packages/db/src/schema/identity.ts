// Users/roles/profiles/addresses — plan.md §6.1, Phase 1. Replaces the
// mock frontend's single hardcoded fixture-per-role (CURRENT_ARTIST_ID etc.)
// with real multi-tenancy. Firebase issues the ID token; this table is what
// authorization is actually derived from (never the token's custom claims —
// see the plan's Security posture section).

import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// Matches frontend-web/types/admin.ts's UserRole. "admin" is intentionally
// coarse here — the finer-grained platform_admin/finance_admin split for
// the rate-config console lives in role_grants below, not as its own enum
// value, so a user can hold "admin" (general moderation) and separately be
// granted "finance_admin" (rate changes) without a data-model change.
export const userRoleValues = ["artist", "aggregator", "customer", "admin"] as const;
export type UserRole = (typeof userRoleValues)[number];

export const userStatusValues = ["pending", "active", "suspended", "blocked"] as const;
export type UserStatus = (typeof userStatusValues)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Firebase UID — the join key between an ID token and this row. Unique,
  // never reused.
  firebaseUid: varchar("firebase_uid", { length: 128 }).notNull().unique(),
  role: varchar("role", { length: 16 }).notNull().$type<UserRole>(),
  status: varchar("status", { length: 16 }).notNull().default("pending").$type<UserStatus>(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

// Narrow, explicit grants layered on top of the coarse role — this is what
// the admin rules console's RBAC check reads (see the plan's Admin rules
// console section: "only a new platform_admin/finance_admin role... can
// propose or approve rate changes"). A grant is itself auditable (who
// granted it, when) rather than a boolean flag on the user row, so revoking
// finance_admin from someone doesn't erase the fact they once had it.
export const roleGrantValues = ["platform_admin", "finance_admin", "moderation_admin"] as const;
export type RoleGrant = (typeof roleGrantValues)[number];

export const userRoleGrants = pgTable("user_role_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  grant: varchar("grant", { length: 32 }).notNull().$type<RoleGrant>(),
  grantedBy: uuid("granted_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedBy: uuid("revoked_by").references(() => users.id, { onDelete: "restrict" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

// Superset profile record — bank details, GSTIN, PAN, Aadhaar status,
// pickup address, MOU acceptance, Instagram, insurance/GST review status —
// merging frontend-web's ad hoc artistProfileCol fixture shape with
// types/artist.ts's typed ArtistProfile into one real, per-user table.
// Split by role at the query layer, not by separate tables, since the
// review-status fields (gstStatus/insuranceNumber's status) are genuinely
// artist-only and customer/aggregator profiles don't carry them — nullable
// columns here, never populated for the wrong role.
export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  bio: text("bio"),
  profileImageUrl: text("profile_image_url"),
  headline: text("headline"),
  location: text("location"),
  instagram: text("instagram"),
  website: text("website"),

  // PAN — admin-visible only, never on the public artist page.
  pan: text("pan"),
  gstin: text("gstin"),
  gstStatus: varchar("gst_status", { length: 16 }),
  aadhaarStatus: varchar("aadhaar_status", { length: 16 }),
  aadhaarMasked: text("aadhaar_masked"),

  bankAccountMasked: text("bank_account_masked"),
  bankAccountEncrypted: text("bank_account_encrypted"), // KMS column encryption, plan.md §14
  ifsc: text("ifsc"),

  pickupLine1: text("pickup_line1"),
  pickupLine2: text("pickup_line2"),
  pickupCity: text("pickup_city"),
  pickupState: text("pickup_state"),
  pickupPincode: text("pickup_pincode"),

  earningsAbove5L: boolean("earnings_above_5l").notNull().default(false),

  socialProofVideoUrl: text("social_proof_video_url"),
  verification: jsonb("verification"), // { tier1SocialMedia, tier2ActivePlan, tier3FirstSale }

  companyName: text("company_name"), // aggregator only
});

// Signed once, per user (artist or aggregator) — mirrors both
// artistProfileCol.mouAcceptance and aggregatorProfileCol.mouAcceptance.
// Append-only: a re-sign after an MOU version bump is a new row, not an
// overwrite, since "when and against which version" is provenance.
export const mouAcceptances = pgTable("mou_acceptances", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  signatureName: text("signature_name").notNull(),
  signatureDataUrl: text("signature_data_url"), // canvas-drawn signature; consider moving to object storage once volume warrants it
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
});
