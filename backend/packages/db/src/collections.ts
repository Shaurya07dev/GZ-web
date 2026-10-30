// Firestore collection layout — replaces the Drizzle schema/*.ts files
// from the Postgres version. Every collection name + document shape a
// module in this package writes to or reads from is declared here once,
// so the mapping between "what plan.md's data model calls a table" and
// "what Firestore actually calls a collection" stays in one reviewable
// place, the same job schema/*.ts did before.
//
// Design notes carried over from the Postgres schema (see git history for
// the original, fuller comments per field if you need the "why"):
//   - Money is still BIGINT-equivalent: plain `number` in paise, never a
//     float rupee amount.
//   - Append-only collections (statusEvents, ledgerEntries, auditLog) are
//     enforced by firestore.rules (`allow write: if false` for clients) +
//     this package never issuing an update/delete against them itself —
//     there's no DB-level trigger to fall back on the way Postgres's
//     CONSTRAINT TRIGGER was, so this convention is the whole guarantee.
//     Treat any code that updates a doc in one of these collections as a
//     bug. ownershipEvents is the one exception: a transfer is one doc
//     whose status moves pending -> accepted | cancelled (ownership.ts is
//     the only writer, via transferStateMachine); once settled it is
//     immutable, and it is never deleted.
//   - artistPricePaise lives in a `pricing` subcollection under each
//     artwork doc, never on the artwork doc itself — see firestore.rules'
//     own comment on why.

import type {
  ArtworkStatus,
  TransferStatus,
  HoldingStatus,
  OrderStatus,
  PenaltyStatus,
  ResaleListingStatus,
  ReviewStatus,
  SettlementStatus,
  ShipmentStatus,
  WithdrawalStatus,
} from "@galleryzone/domain";

export const userRoleValues = ["artist", "aggregator", "customer", "admin"] as const;
export type UserRole = (typeof userRoleValues)[number];

export const userStatusValues = ["pending", "active", "suspended", "blocked"] as const;
export type UserStatus = (typeof userStatusValues)[number];

export type RoleGrant = "platform_admin" | "finance_admin" | "moderation_admin";
export type ListingType = "marketplace_only" | "aggregator_only" | "marketplace_and_aggregator";
export const artworkRarityValues = ["R", "U", "O", "S"] as const;
export type ArtworkRarity = (typeof artworkRarityValues)[number];

/** Standard used to be "N" (Normal); documents ranked before the rename still carry it. */
export function normalizeRarity(value: string | null | undefined): ArtworkRarity | null {
  if (value === "N") return "S";
  return (artworkRarityValues as readonly string[]).includes(value ?? "") ? (value as ArtworkRarity) : null;
}

/**
 * The rank a buyer sees. Every painting has one: approval refuses to go live
 * without it, and a piece approved before that rule reads as Standard until an
 * admin ranks it. Admin screens use normalizeRarity, so they still show it as unranked.
 */
export function publicRank(value: string | null | undefined): ArtworkRarity {
  return normalizeRarity(value) ?? "S";
}

// --- Collection name constants -------------------------------------------------
// Firestore has no schema enforcement, so these constants are the only
// thing stopping a typo from silently creating collection "artwork"
// alongside the real "artworks".

export const Collections = {
  users: "users",
  publicProfiles: "publicProfiles",
  addresses: "addresses",
  artworks: "artworks",
  artworkNfc: "artworkNfc",
  categories: "categories",
  externalSalePenalties: "externalSalePenalties",
  physicalCoaRequests: "physicalCoaRequests",
  orders: "orders",
  payments: "payments",
  walletTopups: "walletTopups",
  earlyAccessEmails: "earlyAccessEmails",
  ledgerAccounts: "ledgerAccounts",
  ledgerEntries: "ledgerEntries",
  settlements: "settlements",
  withdrawalRequests: "withdrawalRequests",
  aggregatorHoldings: "aggregatorHoldings",
  aggregatorSales: "aggregatorSales",
  gallerySpaces: "gallerySpaces",
  buyerInvites: "buyerInvites",
  auditLog: "auditLog",
  /** Pending Secure ID sessions, mapping a verification_id back to the user who started it. */
  verificationSessions: "verificationSessions",
  disputes: "disputes",
  rateConfigVersions: "rateConfigVersions",
  messageThreads: "messageThreads",
  artistReviews: "artistReviews",
  resaleListings: "resaleListings",
  artistSales: "artistSales",
  supportTickets: "supportTickets",
  artistConnections: "artistConnections",
  affiliateProducts: "affiliateProducts",
  blogs: "blogs",
  holdingReports: "holdingReports",
  reservationIntents: "reservationIntents",
} as const;

// Subcollection path helpers — Firestore subcollections are addressed as
// `${parentCollection}/${parentId}/${subcollectionName}`, not a top-level
// constant, so these are functions rather than strings.
export const artworkPricingCol = (artworkId: string) => `artworks/${artworkId}/pricing`;
export const artworkImagesCol = (artworkId: string) => `artworks/${artworkId}/images`;
export const artworkStatusEventsCol = (artworkId: string) => `artworks/${artworkId}/statusEvents`;
export const artworkOwnershipEventsCol = (artworkId: string) => `artworks/${artworkId}/ownershipEvents`;
export const orderStatusEventsCol = (orderId: string) => `orders/${orderId}/statusEvents`;
export const userProfileCol = (userId: string) => `users/${userId}/profile`;
export const userFinancialCol = (userId: string) => `users/${userId}/financial`;

// --- Document shapes ---------------------------------------------------------

export interface UserDoc {
  firebaseUid: string; // == the Firestore doc ID for this collection
  role: UserRole;
  status: UserStatus;
  name: string;
  email: string;
  phone: string | null;
  createdAt: FirebaseFirestore.Timestamp;
  lastLoginAt: FirebaseFirestore.Timestamp | null;
  roleGrants: string[]; // RoleGrant values, kept as string[] for forward-compat with a grant not yet in the RoleGrant union
  /**
   * Artists who are listing on GalleryZone through an external platform
   * rather than directly — the "TR" (technology-register) partners. Admin
   * sets this by hand; it drives a small TR badge in the admin console so
   * internal views can tell partner-sourced artists from native ones.
   * Optional for backward compatibility with user docs written before the
   * field existed — absent reads as false.
   */
  externalArtist?: boolean;
}

/**
 * One machine identity/registry check, kept for the admin who decides and for
 * any later audit. Written by verification.ts; read by the admin panes.
 */
export interface VerificationEvidence {
  /** Which check produced this: "cashfree_gstin" | "cashfree_digilocker". */
  provider: string;
  outcome: "valid" | "invalid" | "failed";
  /** Cashfree's reference, so a result can be traced back in their dashboard. */
  referenceId: string | null;
  /** The name the registry or DigiLocker returned, for the admin to compare against the artist's own. */
  verifiedName: string | null;
  detail: Record<string, unknown> | null;
  checkedAt: FirebaseFirestore.Timestamp;
  /** When the provider says the event happened (its signed webhook timestamp), so a replayed or late older event can't overwrite a newer outcome. */
  eventAtMs?: number | null;
}

export type TourId = "customer" | "artist" | "aggregator" | "admin";

export interface ProfileDoc {
  bio: string | null;
  profileImageUrl: string | null;
  headline: string | null;
  location: string | null;
  instagram: string | null;
  website: string | null;
  pan: string | null;
  gstin: string | null;
  gstStatus: ReviewStatus | null;
  aadhaarStatus: ReviewStatus | null;
  /** The reviewer's reason for the latest rejection, shown to the applicant; null once approved. */
  gstReviewNote?: string | null;
  aadhaarReviewNote?: string | null;
  /** Onboarding tours finished, by tour → the step-set version seen, so a revised tour shows again. */
  toursCompleted?: Partial<Record<TourId, number>>;
  aadhaarMasked: string | null;
  /**
   * What Cashfree Secure ID said, if it was ever asked. Evidence for the admin
   * who decides gstStatus/aadhaarStatus — never an approval in itself
   * (verification.ts explains why).
   */
  gstVerification?: VerificationEvidence | null;
  aadhaarVerification?: VerificationEvidence | null;
  bankAccountMasked: string | null;
  ifsc: string | null;
  pickupLine1: string | null;
  pickupLine2: string | null;
  pickupCity: string | null;
  pickupState: string | null;
  pickupPincode: string | null;
  /** ISO 3166-1 alpha-2 country code. Null on profiles written before
   *  the field existed — those are all Indian and read as "IN". */
  pickupCountry: string | null;
  earningsAbove5L: boolean;
  socialProofVideoUrl: string | null;
  companyName: string | null;
  /**
   * GalleryZone's own 0–10 rating of this artist, set by hand by an admin.
   * One of the three factors in the composite score the artist sees on their
   * dashboard (customer rating + profile completion + this). Admin-only
   * input; never shown to buyers. Null until an admin has rated them.
   */
  galleryzoneRating?: number | null;
}

export interface FinancialDoc {
  bankAccountEncrypted: string | null;
}

export interface PublicProfileDoc {
  name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  profileImageUrl: string | null;
  /** Public portfolio URL. Optional because profiles created before this
   * projection existed do not carry it yet. */
  website?: string | null;
  /** Public behind-the-scenes proof video. Instagram remains private. */
  socialProofVideoUrl?: string | null;
  /** Public verification projection; optional on legacy documents. */
  tier1SocialMedia?: boolean;
  tier2ArtistAgreement?: boolean;
  tier3FirstSale?: boolean;
}

export interface AddressDoc {
  userId: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface ArtworkDoc {
  productCode: string;
  artistId: string;
  title: string;
  description: string;
  category: string;
  medium: string;
  dimensions: string | null;
  yearCreated: number | null;
  artworkType: string | null;
  listingType: ListingType;
  rarityType: ArtworkRarity | null;
  coaCertificateNumber: string | null;
  /** When the certificate number was issued (coa.ts). Null until then. */
  coaIssuedAt: FirebaseFirestore.Timestamp | null;
  /**
   * The NFC chip on this piece (nfc.ts, NFC_IMPLEMENTATION.md §3): unlinked
   * (both null), linked-unlocked (linkedAt), linked-locked (both; irreversible).
   * firestore.rules lets ANYONE read this document, so it carries only the
   * timestamps. The chip's UID and the admin override note live in
   * artworkNfc/{artworkId}, which no client can read — the doc requires the UID
   * to reach only the artist, the holding aggregator and admins.
   * Pieces from before the feature have neither field until the migration
   * script runs, so reads treat a missing one as null.
   */
  nfcLinkedAt: FirebaseFirestore.Timestamp | null;
  nfcLockedAt: FirebaseFirestore.Timestamp | null;
  /** Admin escape hatch for dispatching a piece whose tag is not locked (legacy pieces). The reason is in artworkNfc and the audit log. */
  nfcShipmentGateOverrideAt?: FirebaseFirestore.Timestamp | null;
  insuranceNumber: string | null;
  insuranceStatus: ReviewStatus | null;
  /** Artist opted into transit insurance (MOU §10). Absent on older docs = false. */
  insuranceOpted?: boolean;
  /** Painting-only sub-classification (e.g. "Abstract"). */
  paintingStyle?: string | null;
  /**
   * Marked exclusive to GalleryZone at submission — the piece is a one-of-a-
   * kind original and the artist agrees not to sell it on any other platform.
   * Set once at submit; the backend refuses patches that try to clear it (a
   * one-way flag). Absent on older docs = false.
   */
  exclusive?: boolean;
  /** Shipping/packaging facts the artist declares at submission. */
  physical?: ArtworkPhysical | null;
  editableUntil: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
  /** Denormalised read model (listing-projection.ts). Absent on docs written before it existed — reindex fills it. */
  listing?: ListingProjection;
}

/**
 * The private half of an artwork's NFC state, at artworkNfc/{artworkId}. Server-only
 * (the catch-all rule denies clients), the same reason the artist's price lives in
 * a pricing document and not on the artwork. Absent until a tag is first linked.
 */
export interface ArtworkNfcDoc {
  /** 7-byte chip UID, lowercase hex, no separators. Null after an admin unlink. */
  tagUid: string | null;
  shipmentGateOverrideReason: string | null;
  shipmentGateOverrideBy: string | null;
  /** Reminder emails to lock a linked-but-unlocked tag, so each goes out once per link (nfc-reminders.ts). */
  reminder48hAt?: FirebaseFirestore.Timestamp | null;
  reminder7dAt?: FirebaseFirestore.Timestamp | null;
}

export interface ArtworkPhysical {
  weightKg: number | null;
  framing: string | null;
  format: string | null;
  hangingHardwareIncluded: boolean;
  packagingConfirmed: boolean;
}

/** Mirrors listing-projection.ts's ListingProjection (declared here to avoid an import cycle). */
export interface ListingProjection {
  status: ArtworkStatus;
  onMarketplace: boolean;
  displayPricePaise: number;
  artistName: string;
  /** From publicProfiles/{artistId}.location — an artwork has no location of its own. */
  artistLocation: string | null;
  /** Parsed from `dimensions` ("24 x 36 in") into small/medium/large by area; null when unparseable. */
  sizeBand: "small" | "medium" | "large" | null;
  coverImageUrl: string | null;
  coverThumbnailUrl: string | null;
  imageCount: number;
  updatedAt: FirebaseFirestore.Timestamp;
}

/** Lives at artworkPricingCol(id)/data — never spread into ArtworkDoc's public fields. */
export interface ArtworkPricingDoc {
  artistId: string; // duplicated so firestore.rules can check ownership without a second get()
  artistPricePaise: number;
}

export interface ArtworkImageDoc {
  url: string;
  thumbnailUrl: string | null;
  altText: string | null;
  sortOrder: number;
  storagePath: string;
}

export interface ArtworkStatusEventDoc {
  status: ArtworkStatus;
  changedBy: string | null;
  reason: string | null;
  changedAt: FirebaseFirestore.Timestamp;
}

/**
 * One transfer of legal ownership (or time-boxed display rights) of an
 * artwork. The CURRENT owner is a projection (latest accepted `ownership`
 * event's toUserId, else the artist) — never a field on ArtworkDoc.
 * Sale-triggered transfers (orderId set) are written already-accepted when
 * the order is paid; manual ones start pending and need the recipient.
 */
export interface OwnershipEventDoc {
  kind: "ownership" | "display";
  status: TransferStatus;
  fromUserId: string | null;
  toUserId: string | null;
  /** Manual transfers: the invited recipient before they have an account. Never on the public passport. */
  toEmail: string | null;
  /** Display-name snapshots so the passport needs no user reads (and no PII lookups). */
  fromName: string;
  toName: string;
  /** Set on sale-triggered transfers; makes the payment hook idempotent. */
  orderId: string | null;
  initiatedAt: FirebaseFirestore.Timestamp;
  acceptedAt: FirebaseFirestore.Timestamp | null;
  cancelledAt: FirebaseFirestore.Timestamp | null;
  /** Display transfers: the date the display period opens on. Null for
   *  ownership events, and for older display events that pre-date explicit
   *  start dates (fall back to acceptedAt / initiatedAt on read). */
  displayStartsAt: FirebaseFirestore.Timestamp | null;
  displayEndsAt: FirebaseFirestore.Timestamp | null;
  displayEndedAt: FirebaseFirestore.Timestamp | null;
}

export interface CategoryDoc {
  name: string;
  slug: string;
}

/**
 * An Amazon product GalleryZone recommends, earning a commission on the sale.
 * `url` is the affiliate link exactly as Amazon issued it (it carries the
 * associate tag), so a click is always attributed. No price or rating is
 * stored: the Associates policy allows showing those only from Amazon's own
 * API, refreshed daily, and a stale price shown as current breaks it.
 * Images are Amazon's own CDN URLs, served from Amazon, never re-hosted.
 */
export interface AffiliateProductDoc {
  url: string;
  asin: string | null;
  title: string;
  brand: string | null;
  category: string;
  images: string[];
  active: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface ExternalSalePenaltyDoc {
  artworkId: string;
  amountPaise: number;
  status: PenaltyStatus;
  createdAt: FirebaseFirestore.Timestamp;
  decidedAt: FirebaseFirestore.Timestamp | null;
  decisionNote: string | null;
  settledAt: FirebaseFirestore.Timestamp | null;
}

export interface PhysicalCoaRequestDoc {
  artworkId: string;
  requestedByUserId: string;
  requestedAt: FirebaseFirestore.Timestamp;
  deliveryLine1: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPincode: string;
  status: "requested" | "dispatched";
  dispatchedAt: FirebaseFirestore.Timestamp | null;
  courierRef: string | null;
}

export interface OrderDoc {
  artworkId: string;
  customerId: string;
  addressId: string;
  displayPricePaise: number;
  gstPaise: number;
  deliveryChargePaise: number;
  convenienceFeePaise: number;
  /** 18% service GST on the convenience fee — zero while that fee is zero. */
  convenienceGstPaise: number;
  totalPaise: number;
  status: OrderStatus;
  rateConfigVersionId: string;
  /** The artist and their price when the buyer's total was fixed. The sale settles on these, never
   *  on the live price, which the artist may still edit. Absent on orders created before 2026-10-30. */
  artistId?: string;
  artistPricePaise?: number;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface OrderStatusEventDoc {
  status: OrderStatus;
  changedAt: FirebaseFirestore.Timestamp;
}

export interface PaymentDoc {
  orderId: string;
  provider: string;
  providerPaymentId: string | null;
  /** The gateway's own order id (Razorpay generates its own `order_...`), set when a checkout session is opened. */
  providerOrderId?: string | null;
  method: string | null;
  amountPaise: number;
  idempotencyKey: string;
  status: string;
  rawWebhookPayload: unknown;
  createdAt: FirebaseFirestore.Timestamp;
}

/** One gateway top-up of an aggregator's wallet. Server-only: the catch-all rule denies clients. */
export interface WalletTopupDoc {
  userId: string;
  amountPaise: number;
  status: "pending" | "paid" | "failed";
  /** The gateway's own order id (Razorpay generates its own `order_...`), set when checkout opens. */
  providerOrderId: string | null;
  providerPaymentId: string | null;
  method: string | null;
  createdAt: FirebaseFirestore.Timestamp;
  paidAt: FirebaseFirestore.Timestamp | null;
}

export type LedgerAccountType =
  | "artist_payable"
  | "aggregator_payable"
  | "aggregator_held"
  | "customer_wallet"
  | "platform_revenue"
  | "gateway_escrow"
  // Historical: what "gateway_escrow" was called while the gateway was
  // Razorpay. Kept in the union so ledger entries written before the move to
  // Cashfree still read back typed. Nothing writes it any more; scripts/
  // migrate-escrow-account.ts repoints the old docs.
  | "razorpay_escrow"
  | "gst_payable"
  | "tds_payable";

export interface LedgerAccountDoc {
  type: LedgerAccountType;
  ownerId: string | null;
}

export interface LedgerEntryDoc {
  transactionId: string;
  accountId: string;
  amountPaise: number;
  reason: string;
  relatedOrderId: string | null;
  relatedHoldingId: string | null;
  idempotencyKey: string; // enforced unique via idempotencyKey-as-doc-ID, see ledger-repository.ts
  createdAt: FirebaseFirestore.Timestamp;
}

export interface SettlementDoc {
  orderId: string | null;
  holdingId: string | null;
  artistId: string;
  artistAmountPaise: number;
  aggregatorCommissionPaise: number | null;
  platformRevenuePaise: number;
  status: SettlementStatus;
  releaseAfter: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
  processedAt: FirebaseFirestore.Timestamp | null;
}

export interface WithdrawalRequestDoc {
  userId: string;
  amountPaise: number;
  status: WithdrawalStatus;
  requestedAt: FirebaseFirestore.Timestamp;
  processedAt: FirebaseFirestore.Timestamp | null;
}

export interface AggregatorHoldingDoc {
  /** Set once a sale or a return has started (holding-claim.ts); the other is then refused. */
  closingAs?: "sale" | "return";
  artworkId: string;
  aggregatorId: string;
  cycleMonth: number;
  advancePercent: number;
  advanceAmountPaise: number;
  deliveryDepositPaise: number | null;
  /** What the customer sees: sellingPricePaise plus GST. */
  displayPricePaise: number;
  /**
   * The price before GST. Month 1: what the aggregator chose when reserving,
   * never below GalleryZone's offer. Later months: GalleryZone's price, fixed.
   * Absent on holdings from before 30 Sep 2026: displayPricePaise less GST.
   */
  sellingPricePaise?: number;
  /** Month 1 only: priced above GalleryZone's offer. Decides when the next aggregator's monthly drops start. Absent = false. */
  appreciated?: boolean;
  /** Priced far enough above the offer (aggregatorPriceWarnRate) that GalleryZone was warned. */
  priceWarning?: boolean;
  assignmentSource: "self_reserved" | "gz_assigned";
  assignedAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
  windowExtended: boolean;
  status: HoldingStatus;
  returnedAt: FirebaseFirestore.Timestamp | null;
  /** The latest request to keep the piece past its window. Only the latest is kept; decisions are also in the audit log. */
  extensionRequest?: HoldingExtensionRequest;
  /**
   * Artist -> aggregator inbound shipment, when GalleryZone is routing it
   * through ShipRocket. Mirror of the outbound tracking fields on
   * AggregatorSaleDoc: the stage comes from ShipRocket webhooks. Absent
   * until a shipment has been booked.
   */
  inboundShiprocketStage?: "pickup" | "in_transit" | "out_for_delivery" | "delivered" | null;
  inboundTrackingId?: string | null;
  inboundCarrier?: string | null;
  inboundTrackedAt?: FirebaseFirestore.Timestamp | null;
}

export interface HoldingExtensionRequest {
  requestedAt: FirebaseFirestore.Timestamp;
  /** The aggregator's assurance that the piece will sell. */
  assurance: string;
  status: "pending" | "approved" | "declined";
  decidedAt: FirebaseFirestore.Timestamp | null;
  /** The admin who decided. Null when the window ended before anyone did. */
  decidedBy: string | null;
  note: string | null;
  /** Where the window ended before this request, so a decision can show what changed. */
  previousExpiresAt: FirebaseFirestore.Timestamp;
}

/**
 * One artist sale, kept for §194-O: what counted towards the ₹5 lakh
 * financial-year line and what was withheld on it. Written in the same
 * transaction as the sale's ledger entries (artist-sales.ts), its id is the
 * sale's idempotency key, and it is server-only (firestore.rules denies
 * clients), so nothing here can reach a buyer.
 */
export interface ArtistSaleDoc {
  artistId: string;
  /** Financial year, e.g. "2026-27". */
  fyKey: string;
  channel: "marketplace" | "aggregator";
  artistPricePaise: number;
  tdsPaise: number;
  /** What the sale credited to the artist's payable, after every deduction. */
  netPaise: number;
  orderId: string | null;
  holdingId: string | null;
  soldAt: FirebaseFirestore.Timestamp;
}

export interface AggregatorSaleDoc {
  holdingId: string;
  artworkId: string;
  soldPricePaise: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  deliveryAddress: string | null;
  deliveryMode: "courier" | "self_pickup";
  paymentRoute: "direct_to_galleryzone" | "cash_at_premises";
  remittedAt: FirebaseFirestore.Timestamp | null;
  /** Cash sales: when the full price is due at GalleryZone. Absent on sales recorded before there was a deadline. */
  remitDueAt?: FirebaseFirestore.Timestamp | null;
  /** How the price was paid in: from the aggregator's wallet here, or by transfer to GalleryZone's bank. */
  remittedVia?: "wallet" | "bank" | null;
  shipmentStatus: ShipmentStatus;
  dispatchedAt: FirebaseFirestore.Timestamp | null;
  deliveredAt: FirebaseFirestore.Timestamp | null;
  courierRef: string | null;
  /**
   * ShipRocket tracking, added alongside the existing manual shipmentStatus
   * so both can coexist. Updated by the ShipRocket webhook; stays null when
   * the shipment is handled manually.
   *   pickup           — waybill issued, courier assigned, awaiting pickup
   *   in_transit       — picked up, on the way
   *   out_for_delivery — on the delivery vehicle
   *   delivered        — handed to the recipient
   */
  shiprocketStage?: "pickup" | "in_transit" | "out_for_delivery" | "delivered" | null;
  /** The AWB (waybill) number ShipRocket assigns — what the recipient uses
   *  to track the parcel on the courier's own website. */
  trackingId?: string | null;
  /** Courier picked by ShipRocket (BlueDart, Delhivery, etc). */
  carrier?: string | null;
  /** When the ShipRocket webhook last updated the record. */
  trackedAt?: FirebaseFirestore.Timestamp | null;
  soldAt: FirebaseFirestore.Timestamp;
   /** The commission rate (fraction of markup) actually billed on this sale.
    *  Picked from aggregatorCommissionSlabs at sale time, based on the
    *  immediately previous calendar month's eligible pre-GST listed sales.
    *  Stored for audit so a changed slab table never retroactively
   *  rewrites what was billed. Absent on sales recorded before the slab
   *  feature existed; readers fall back to rates.aggregatorCommissionRate. */
  commissionRate?: number;
}

export interface GallerySpaceDoc {
  aggregatorId: string;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  capacity: number | null;
  coordinatorName: string | null;
}

export interface BuyerInviteDoc {
  email: string;
  name: string;
  artworkId: string;
  soldPricePaise: number;
  soldAt: FirebaseFirestore.Timestamp;
  source: string;
  claimedAt: FirebaseFirestore.Timestamp | null;
}

export interface AuditLogDoc {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  detail: unknown;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface DisputeDoc {
  orderId: string | null;
  artworkId: string | null;
  raisedByUserId: string;
  reason: string;
  status: string;
  createdAt: FirebaseFirestore.Timestamp;
  resolvedAt: FirebaseFirestore.Timestamp | null;
  resolutionNote: string | null;
}

export interface RateConfigVersionDoc {
  rates: unknown; // PricingRates, kept untyped here to avoid a domain<->db circular import; cast at the call site
  effectiveFrom: FirebaseFirestore.Timestamp;
  proposedBy: string;
  proposedAt: FirebaseFirestore.Timestamp;
  approvedBy: string | null;
  approvedAt: FirebaseFirestore.Timestamp | null;
  // Redundant with `approvedBy !== null` but real: Firestore can't
  // combine a "field != null" filter with an orderBy on a different field
  // without an awkward composite-index workaround, so getActiveVersion()
  // filters on this plain boolean instead.
  approved: boolean;
  reason: string;
}

export interface MessageThreadDoc {
  userId: string;
  fromLabel: string;
  subject: string;
  preview: string;
  body: string;
  unread: boolean;
  receivedAt: FirebaseFirestore.Timestamp;
}

export interface ArtistReviewDoc {
  artistId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  artworkId: string | null;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface ResaleListingDoc {
  sellerId: string;
  artworkId: string;
  listedPricePaise: number;
  status: ResaleListingStatus;
  listedAt: FirebaseFirestore.Timestamp;
}

export interface SupportTicketDoc {
  userId: string;
  subject: string;
  message: string;
  status: "open" | "answered" | "closed";
  createdAt: FirebaseFirestore.Timestamp;
}

export interface ArtistConnectionDoc {
  requesterId: string;
  recipientId: string;
  status: "pending" | "accepted" | "declined";
  message: string | null;
  requestedAt: FirebaseFirestore.Timestamp;
  respondedAt: FirebaseFirestore.Timestamp | null;
}

// Artist-authored blog post. Submitted by an artist, reviewed and published
// by an admin. The public /blogs page only reads `published` entries.
export type BlogStatus = "submitted" | "accepted" | "rejected";

export interface BlogDoc {
  authorId: string; // artist uid
  authorName: string; // snapshot at submission so public reads need no join
  title: string;
  slug: string; // auto-generated from title at submit time, kebab-case, unique
  excerpt: string; // short summary shown on the blog list
  body: string; // plain text; newlines preserved for paragraphs
  coverImageUrl: string | null;
  status: BlogStatus;
  decisionNote: string | null; // admin's reason on reject
  submittedAt: FirebaseFirestore.Timestamp;
  decidedAt: FirebaseFirestore.Timestamp | null;
  decidedBy: string | null; // admin uid
  publishedAt: FirebaseFirestore.Timestamp | null;
}

// An aggregator-raised issue report about a piece they're holding. Opens
// from /aggregator/holdings/<id> detail page; admin reads them from
// /admin/moderation/holding-reports. Snapshot fields (artworkTitle,
// aggregatorName, artistName) are duplicated so the admin list renders
// without needing joined reads for every row.
export type HoldingReportIssueType =
  | "damaged_in_transit"
  | "wrong_piece"
  | "quality_issue"
  | "coa_nfc_problem"
  | "missing_accessories"
  | "other";

export type HoldingReportStatus = "open" | "resolved";

export interface HoldingReportDoc {
  holdingId: string;
  artworkId: string;
  artworkTitle: string;
  aggregatorId: string;
  aggregatorName: string;
  aggregatorEmail: string;
  artistId: string;
  artistName: string;
  issueType: HoldingReportIssueType;
  description: string;
  status: HoldingReportStatus;
  reportedAt: FirebaseFirestore.Timestamp;
  resolvedAt: FirebaseFirestore.Timestamp | null;
  resolvedBy: string | null; // admin uid
  resolutionNote: string | null;
}

/**
 * An in-flight aggregator reservation payment. Created when an aggregator
 * clicks "Reserve" — the server locks the amount, opens a Razorpay order, and
 * only CREATES the holding after the payment is verified AND the allocation
 * is still free (reservation-intents.ts owns the atomic transaction).
 *
 * Why a separate collection and not a field on AggregatorHoldingDoc:
 *   - Before finalize, there's no holding yet (someone else may still win
 *     the race). The intent is the only record of "money is being asked for".
 *   - If a payment captures but the allocation is lost (someone else was
 *     verified first), the intent records the refund that returns the money.
 *   - Idempotency keys live here, not on the holding — the client can retry
 *     the init call safely without creating two Razorpay orders.
 *
 * States move only forward (except created→cancelled on expiry):
 *   created  — amount locked, Razorpay order attached, awaiting the buyer
 *   paid     — Razorpay confirmed capture; finalize transaction running
 *   finalized — holding written, intent is permanently settled
 *   needs_refund — paid but allocation lost (race or stale state); refund queued
 *   refunded — Razorpay refund succeeded; money is back with the buyer
 *   expired  — never paid before expiresAt; no money moved
 *   cancelled — buyer dismissed, verify confirmed no payment; no money moved
 */
export type ReservationIntentStatus =
  | "created"
  | "paid"
  | "finalized"
  | "needs_refund"
  | "refunded"
  | "expired"
  | "cancelled";

export interface ReservationIntentDoc {
  aggregatorId: string;
  artworkId: string;
  /** The aggregator's chosen pre-GST price (month 1 only). Null = GalleryZone's offer. */
  sellingPricePaise: number | null;
  /** Snapshotted from the offer at init time so the amount can't drift between init and verify. */
  advanceAmountPaise: number;
  deliveryDepositPaise: number;
  /** advance + deliveryDeposit — what Razorpay charges. */
  totalPayablePaise: number;
  /** Client-supplied; same key within TTL returns the same intent. */
  idempotencyKey: string;
  /** Razorpay order id, attached after the gateway call. Null while in flight. */
  providerOrderId: string | null;
  providerPaymentId: string | null;
  /** Razorpay refund id when a lost-race refund has been issued. */
  providerRefundId: string | null;
  /** Set only once finalize succeeds. */
  holdingId: string | null;
  /** Why this intent is in needs_refund / cancelled / expired — for admin triage. */
  failureReason: string | null;
  status: ReservationIntentStatus;
  createdAt: FirebaseFirestore.Timestamp;
  /** The buyer has this long to complete payment before the intent expires. */
  expiresAt: FirebaseFirestore.Timestamp;
  paidAt: FirebaseFirestore.Timestamp | null;
  finalizedAt: FirebaseFirestore.Timestamp | null;
  refundedAt: FirebaseFirestore.Timestamp | null;
}
