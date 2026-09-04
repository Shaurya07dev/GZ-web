// Messaging, ratings, resale, support, artist-network connections — the
// tables the plan's "Scope calls" section flagged as open with the client
// (parity-only vs. real send/browse/resolve). Built here at PARITY scope
// only — matching exactly what the mock frontend does today (read+markRead
// inboxes, seed-only reviews, seller-only resale listings, list+submit
// tickets) — so nothing here forecloses the client's answer; expanding any
// of these to full scope is additive columns/tables, not a rewrite.

import { bigint, boolean, index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./identity.ts";
import { artworks } from "./artwork.ts";

// --- Messaging (parity: inbox read/markRead only, no compose/send) ---------

export const messageThreads = pgTable("message_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // recipient — artist or aggregator inbox
  fromLabel: text("from_label").notNull(), // e.g. "GalleryZone Curation Team" — system-authored, not another user
  subject: text("subject").notNull(),
  preview: text("preview").notNull(),
  body: text("body").notNull(),
  unread: boolean("unread").notNull().default(true),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("message_threads_user_id_idx").on(table.userId)]);

// --- Ratings (parity: seed/system-created only — see the separately
// tracked rating-card composite-score work on the frontend for the open
// "who can submit a review" question; this table doesn't presuppose the
// answer, it just stores whatever a review-creation endpoint eventually
// writes to it). ---------------------------------------------------------

export const artistReviews = pgTable("artist_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  artistId: uuid("artist_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reviewerName: text("reviewer_name").notNull(),
  rating: integer("rating").notNull(), // 1-5, enforced at the app layer (CHECK constraint added once db access exists)
  comment: text("comment").notNull(),
  artworkId: uuid("artwork_id").references(() => artworks.id, { onDelete: "set null" }), // a rating is always earned on a sale — see types/artist-rating.ts's own comment
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("artist_reviews_artist_id_idx").on(table.artistId)]);

// --- Resale (parity: seller-list-only; no buyer browse/purchase flow) ------

export const resaleListings = pgTable("resale_listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sellerId: uuid("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }), // the customer reselling
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id, { onDelete: "restrict" }),
  listedPricePaise: bigint("listed_price_paise", { mode: "number" }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  listedAt: timestamp("listed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("resale_listings_seller_id_idx").on(table.sellerId)]);

// --- Support (parity: three near-duplicate list+submit surfaces, no admin
// resolution view yet — kept as ONE table with a role column rather than
// three, since the parity-scope difference between artist/aggregator/
// customer support was organizational in the mock, not structural). -------

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("open"), // open | answered | closed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("support_tickets_user_id_idx").on(table.userId)]);

// --- Artist network (peer connections, not customer-facing) -----------------

export const artistConnections = pgTable("artist_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  message: text("message"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
}, (table) => [
  index("artist_connections_requester_id_idx").on(table.requesterId),
  index("artist_connections_recipient_id_idx").on(table.recipientId),
]);
