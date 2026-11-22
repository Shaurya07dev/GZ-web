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
export const artworkRarityValues = ["R", "U", "O", "S", "G"] as const;
export type ArtworkRarity = (typeof artworkRarityValues)[number];

/**
 * Standard used to be "N" (Normal); documents ranked before the rename still
 * carry it. Returns null for anything else — publicRank() applies the General
 * fallback for buyer-facing display, admin screens show it as unranked.
 */
export function normalizeRarity(value: string | null | undefined): ArtworkRarity | null {
  if (value === "N") return "S";
  return (artworkRarityValues as readonly string[]).includes(value ?? "") ? (value as ArtworkRarity) : null;
}

/**
 * The rank a buyer sees. Every piece shows one: approval encourages setting
 * R/U/O/S, but anything unranked (or ranked before this field existed) reads
 * as "General" (G) on buyer-facing surfaces so cards never render without a
 * stamp. Admin screens use normalizeRarity, so they still show it as unranked.
 */
export function publicRank(value: string | null | undefined): ArtworkRarity {
  return normalizeRarity(value) ?? "G";
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
  broadcasts: "broadcasts",
  enquiries: "enquiries",
  artistReviews: "artistReviews",
  resaleListings: "resaleListings",
  artistSales: "artistSales",
  supportTickets: "supportTickets",
  artistConnections: "artistConnections",
  affiliateProducts: "affiliateProducts",
  blogs: "blogs",
  holdingReports: "holdingReports",
  reservationIntents: "reservationIntents",
  /** Monotonic invoice-number counters, one doc per fiscal year (`FY2026-27`). */
  invoiceCounters: "invoiceCounters",
  /** Monotonic delivery-challan counter, one doc per fiscal year.
   *  Separate from invoiceCounters because Rule 55 challans have their
   *  own numbering series ("GZ/DC/26-27/000001") distinct from the GST
   *  invoice series. Added 22 Nov 2026 so every non-sale Shiprocket leg
   *  (artist→aggregator, aggregator→artist return, rotation) ships with
   *  the legally required document. */
  deliveryChallanCounters: "deliveryChallanCounters",
  /** Monotonic payment-voucher counter (Rule 52 purchase-cum-payment
   *  bills GZ issues to the artist when releasing their settlement).
   *  Own series "GZ/PV/26-27/000001" distinct from tax invoices and
   *  delivery challans. Added 22 Nov 2026 — artist pays nothing for
   *  this doc but it's legally required when paying an unregistered
   *  supplier. */
  paymentVoucherCounters: "paymentVoucherCounters",
  /** Monotonic aggregator-commission-invoice counter — the self-invoice
   *  GZ generates on behalf of the aggregator for their tier share of
   *  the markup pool on a facilitated counter sale (MOU Clause 9.6
   *  v2026.4). Own series "GZ/AC/26-27/000001" distinct from tax
   *  invoices, delivery challans and payment vouchers. Added 22 Nov
   *  2026. The aggregator agrees to the invoice contents in-portal;
   *  acceptance timestamp + IP is stamped on the snapshot. */
  aggregatorCommissionInvoiceCounters: "aggregatorCommissionInvoiceCounters",
  aggregatorRemittances: "aggregatorRemittances",
  /** Per-user shopping cart doc (one per uid). */
  carts: "carts",
  /**
   * Short-lived hold on a one-of-a-kind artwork while a buyer walks to
   * Razorpay. One doc per artworkId. Added 16 Nov 2026 to prevent two
   * buyers racing to pay for the same original: whoever reserves first
   * has ~10 minutes to complete payment, everyone else sees a "reserved
   * by another collector" notice. Expired docs get cleared lazily by
   * createOrder's own transaction.
   */
  artworkReservations: "artworkReservations",
  /**
   * Per-user wishlist (saved artworks). One doc per uid, same shape as
   * carts: owned by the user, read/write only by them. Added 8 Nov 2026 —
   * client-only wishlist on web+mobile was not syncing across devices.
   */
  wishlists: "wishlists",
  /**
   * Per-user follows (artist IDs the user subscribes to). One doc per uid.
   * Added 8 Nov 2026 alongside wishlists for the same reason.
   */
  follows: "follows",
  /**
   * Email + phone one-time passwords (OTP). Doc id is the hashed identifier
   * (email or `+91XXXXXXXXXX`), so a second request for the same identifier
   * replaces the pending code and takes its attempt count with it.
   */
  otps: "otps",
  /**
   * Admin-created marketplace discount codes. Doc id is the lowercased
   * code so the lookup is a direct `get()` — codes are case-insensitive
   * by convention (e.g. "DIWALI25" and "diwali25" are the same coupon).
   * Discount is absorbed by platform_revenue; artist payouts never move.
   */
  coupons: "coupons",
} as const;

// Subcollection path helpers — Firestore subcollections are addressed as
// `${parentCollection}/${parentId}/${subcollectionName}`, not a top-level
// constant, so these are functions rather than strings.
export const artworkPricingCol = (artworkId: string) => `artworks/${artworkId}/pricing`;
export const artworkImagesCol = (artworkId: string) => `artworks/${artworkId}/images`;
export const artworkStatusEventsCol = (artworkId: string) => `artworks/${artworkId}/statusEvents`;
export const artworkOwnershipEventsCol = (artworkId: string) => `artworks/${artworkId}/ownershipEvents`;
export const orderStatusEventsCol = (orderId: string) => `orders/${orderId}/statusEvents`;

/** Per-coupon redemption ledger. */
export const couponRedemptionsCol = (code: string) => `coupons/${code}/redemptions`;
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
  /**
   * Set when the signed-up user has entered the 6-digit code sent to their
   * email. Firebase Auth's own emailVerified flag is only flipped when the
   * user clicks a one-time magic link, which we no longer send; this is the
   * app-level truth. Owner directive 3 Nov 2026.
   */
  emailVerifiedAt?: FirebaseFirestore.Timestamp | null;
  /**
   * Set when the user has entered the 6-digit code sent via MSG91 SMS to the
   * phone number on this account. The number itself is on `phone`. Separate
   * from `emailVerifiedAt` because the two steps are independent.
   */
  phoneVerifiedAt?: FirebaseFirestore.Timestamp | null;
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
  /**
   * Payout approval — distinct from KYC. Set to "submitted" automatically
   * every time bank account OR IFSC changes (profiles.ts). Admin approves
   * or rejects via /v1/admin/moderation/payout. An artist can only be paid
   * out when this is "approved". Client flag 19 Nov 2026: KYC approval
   * previously covered everything, which meant an admin could mark a KYC
   * approved without ever confirming the payout destination.
   */
  payoutStatus?: ReviewStatus | null;
  /** Rejection reason from the admin, shown to the artist until they resubmit. */
  payoutReviewNote?: string | null;
  pickupLine1: string | null;
  pickupLine2: string | null;
  pickupCity: string | null;
  pickupState: string | null;
  pickupPincode: string | null;
  /** ISO 3166-1 alpha-2 country code. Null on profiles written before
   *  the field existed — those are all Indian and read as "IN". */
  pickupCountry: string | null;
  /**
   * The Shiprocket pickup-location nickname registered for this artist.
   * Each artist is their own Shiprocket warehouse so the courier is
   * routed to THEIR studio, not GalleryZone HQ. Lazy-created on first
   * sale inside `ensureArtistPickupNickname` (apps/api/src/shiprocket-
   * booking.ts). Null until their first order's booking runs. Clear
   * this field + re-register if the artist's pickup address changes.
   * Added 16 Nov 2026 after a live order went out routed to HQ.
   */
  shiprocketPickupNickname?: string | null;
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
  /** Per-channel notification opt-outs. Absent = everything opted in, which
   *  is the safe default for a transactional-only sender. Audit §8. */
  notificationPreferences?: NotificationPreferences;
}

/**
 * What the user has opted out of. Transactional emails (order paid, password
 * reset, settlement failed) ignore these — they're legally/operationally
 * required. Only marketing-adjacent categories (abandoned cart, promotions)
 * check them.
 */
export interface NotificationPreferences {
  /** Reminder when the buyer has pieces sitting in their cart for 24h+. */
  abandonedCart?: boolean;
  /** Platform-wide announcements, new-artist drops, feature releases. */
  marketing?: boolean;
  /** Weekly digest of marketplace activity (artist/aggregator only). */
  weeklyDigest?: boolean;
  /** Push notifications on registered devices for any category. */
  pushEnabled?: boolean;
}

/**
 * Live device tokens for FCM. One doc per device, under
 * users/{uid}/fcmTokens/{token}. We keep the token itself as the doc id so
 * registering the same token twice is a no-op. Audit §8.
 */
export interface FcmTokenDoc {
  token: string;
  platform: "ios" | "android" | "web";
  deviceLabel: string | null;
  createdAt: FirebaseFirestore.Timestamp;
  lastSeenAt: FirebaseFirestore.Timestamp;
}

export const userFcmTokensCol = (userId: string) => `users/${userId}/fcmTokens`;

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
  /**
   * Admin-set pin-to-top deadline. When this is in the future, the piece
   * floats above the rest of the marketplace grid, sorted by this field
   * descending then createdAt descending. Cleared by setting to null;
   * expires naturally when the deadline passes. Independent of status —
   * pinning a sold piece is pointless but not forbidden. 16 Nov 2026.
   */
  promotedUntil?: FirebaseFirestore.Timestamp | null;
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
  /** Every photo, cover first (up to 8), so a list card can be swiped through without a request per piece.
   *  Absent on listings written before 18 Nov 2026 until they are rebuilt (reindexAllListings). */
  images?: { url: string; thumbnailUrl: string | null }[];
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
  /**
   * Resale royalty fields (ownership kind only). What the sender declared
   * the piece is changing hands for, the split (2% artist, 3% platform),
   * the GST on the fee (18%), and the total the sender pays through our
   * gateway. Null on display transfers and on sale-triggered events (the
   * marketplace order already carried its own fee). Older ownership
   * events that pre-date this field are null too; the admin screen treats
   * null the same as 0 for display purposes.
   */
  givingPricePaise?: number | null;
  royaltyPaise?: number | null;
  platformFeeNetPaise?: number | null;
  feeGstPaise?: number | null;
  feeTotalPaise?: number | null;
  /** Razorpay order id for the sender's fee payment. */
  feeProviderOrderId?: string | null;
  /** Captured payment id when the webhook (or verify) marks it paid. */
  feeProviderPaymentId?: string | null;
  feePaidAt?: FirebaseFirestore.Timestamp | null;
  /** The settlement doc that carries the 2% royalty owed to the artist. */
  royaltySettlementId?: string | null;
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

/**
 * Snapshot of the live ShipRocket serviceability quote at order-creation time.
 * Null when ShipRocket was unavailable / no serviceable courier / dev-mode;
 * the UI uses `null` to render an "estimated — final at dispatch" badge next
 * to the delivery line. Added 2026-10-30; older orders carry no field at all.
 */
export interface OrderShippingQuote {
  carrier: string;
  ratePaise: number;
  courierCompanyId: number;
  estimatedDeliveryDays: number | null;
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
  /** Live ShipRocket quote this delivery charge was based on, or null if the flat fallback was used. */
  shippingQuote?: OrderShippingQuote | null;
  /** The artist and their price when the buyer's total was fixed. The sale settles on these, never
   *  on the live price, which the artist may still edit. Absent on orders created before 2026-10-30. */
  artistId?: string;
  artistPricePaise?: number;
  createdAt: FirebaseFirestore.Timestamp;
  /** Tax-invoice snapshot — stamped on first PDF request and never rewritten,
   *  so the invoice number and tax split stay stable regardless of later rate
   *  changes or buyer-address edits. Audit §9. */
  invoice?: InvoiceSnapshot | null;
  /** Delivery-challan snapshot stamped on the SHIPMENT leg from artist
   *  studio to the buyer (marketplace sale) or aggregator venue to the
   *  buyer (aggregator sale). Movement with a sale still needs the tax
   *  invoice attached; the challan is complementary and kept for
   *  internal records. For non-sale legs (artist→aggregator rotation,
   *  returns) see AggregatorHoldingDoc.deliveryChallan. */
  deliveryChallan?: DeliveryChallanSnapshot | null;
  /** Rule 52 purchase-cum-payment bill — stamped at the moment admin
   *  releases the artist's settlement for this order. Carries the
   *  final paid-out amount, the deductions (TDS, convenience,
   *  technology, service GST, delivery, platform facilitation), and
   *  the artist's unregistered/registered status. Downloaded by the
   *  artist from their payouts page + by admin from the settlement
   *  queue. Frozen once stamped. 22 Nov 2026. */
  purchaseBill?: PurchaseBillSnapshot | null;
  /** Set by markOrderRefunded when admin issues a Razorpay refund. The
   *  order status is also moved to "cancelled" in the same write. Absent on
   *  orders that were never refunded. Added 8 Nov 2026. */
  refundedAt?: FirebaseFirestore.Timestamp | null;
  providerRefundId?: string | null;
  refundReason?: string | null;
  /** Live Shiprocket stage for the artist → buyer leg. Null until
   *  bookOutboundOrderShipment has booked the shipment. The webhook
   *  advances it (pickup → in_transit → out_for_delivery → delivered)
   *  and the status machine moves Order.status in lockstep. 9 Nov 2026. */
  shiprocketStage?: "pickup" | "in_transit" | "out_for_delivery" | "delivered" | null;
  shiprocketTrackingId?: string | null;
  shiprocketCarrier?: string | null;
  shiprocketTrackedAt?: FirebaseFirestore.Timestamp | null;
  /** Admin-created discount code the buyer applied at checkout, lowercased
   *  to match the coupons/{code} doc id. Absent when no code was used. */
  couponCode?: string | null;
  /** The discount this coupon took off the customer total. Paise.
   *  GalleryZone's platform revenue absorbs it — artist/aggregator
   *  payouts are untouched. Absent when no coupon was used. */
  couponDiscountPaise?: number | null;
}

/** One row of the tax invoice — item name, HSN/SAC, taxable value, rate,
 *  and the GST split the invoice chose for the whole supply. Intra-state
 *  rows carry cgstPaise + sgstPaise; inter-state rows carry igstPaise.
 *  Lines with gstRatePercent = 0 are pass-through (no GST collected on
 *  the buyer, e.g. shipping handled as pure-agent reimbursement). */
export interface InvoiceLine {
  description: string;
  /** HSN for goods (8 digits), SAC for services (6 digits). */
  hsnOrSac: string;
  qty: number;
  /** Pre-tax unit price in paise. */
  unitPricePaise: number;
  /** qty × unitPricePaise. Pre-tax taxable value for this row. */
  taxablePaise: number;
  /** 0, 5, 12, 18, 28. 0 = non-taxable pass-through on the invoice. */
  gstRatePercent: 0 | 5 | 12 | 18 | 28;
  /** Intra-state only. Half of the line's GST (rounding remainder lands on sgst). */
  cgstPaise?: number;
  /** Intra-state only. Labelled SGST by default; relabelled UTGST on the
   *  PDF when the seller is in a UT-without-legislature (see
   *  `InvoiceSnapshot.usesUtgst`). */
  sgstPaise?: number;
  /** Inter-state only. Full GST amount for this row. */
  igstPaise?: number;
}

/** Lives on the order doc so the invoice number can't drift across reads. */
export interface InvoiceSnapshot {
  /** Human-readable invoice number, e.g. "GZ/26-27/000001". Globally unique. */
  number: string;
  /** Fiscal year the counter was drawn from, e.g. "FY2026-27". */
  fiscalYear: string;
  /** Issuer letterhead — GalleryZone itself. The invoice is issued by
   *  GalleryZone (the marketplace / payment collector); the artist who
   *  owns the piece appears separately under `soldBy`. */
  seller: {
    legalName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    gstin: string | null;
    stateCode: string;
  };
  /** The artist who actually sold the art piece — printed as "Sold By"
   *  on the invoice, with their PAN and (when registered) GSTIN. All
   *  fields are frozen at stamp time: later profile edits never change
   *  what was printed. Optional only to cover any order from before this
   *  field was introduced (20 Nov 2026). */
  soldBy?: {
    legalName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    /** Two-letter postal abbreviation, e.g. "TS". */
    stateCode: string;
    /** Official two-digit GST state code, e.g. "36" (Telangana). */
    numericCode: string;
    pan: string | null;
    gstin: string | null;
  };
  /** Buyer identity + place of supply frozen at stamp time. */
  buyer: {
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    /** Buyer's GSTIN when the supply is B2B — pulled from their profile
     *  at stamp time. Null when the buyer has no GSTIN on file. */
    gstin?: string | null;
  };
  /** Buyer-visible order id and the moment they placed it — the invoice
   *  shows both alongside the invoice number/date so the buyer can tie
   *  the invoice back to the order they placed. */
  orderNumber?: string;
  orderDate?: FirebaseFirestore.Timestamp;
  /** Razorpay (or future gateway) payment capture details, frozen onto
   *  the snapshot so the "Payment Transaction ID / Date & Time / Mode"
   *  footer never drifts away from what the buyer actually paid. */
  payment?: {
    transactionId: string | null;
    method: string | null;
    paidAt: FirebaseFirestore.Timestamp | null;
  };
  /** Place of delivery (the buyer's shipping-address state) — for goods
   *  the same as `placeOfSupply`, but kept as a distinct field in case a
   *  future bill-to vs ship-to divergence has to be printed separately. */
  placeOfDelivery?: {
    state: string;
    numericCode: string;
    code: string;
  };
  /** How the GST was split in total across every line. Intra-state carries
   *  cgst + sgst; inter-state carries igst. The per-line amounts in
   *  `lines[]` sum to this (inter-state igst == sum of line igsts; intra
   *  cgst/sgst likewise), so an accountant can audit top-down or line-up.
   *  Older snapshots written before per-line breakdown may omit `lines`. */
  taxBreakdown:
    | { kind: "intra_state"; cgstPaise: number; sgstPaise: number }
    | { kind: "inter_state"; igstPaise: number };
  /** Per-line breakdown. Optional on pre-November-2026 invoices. */
  lines?: InvoiceLine[];
  /** True when the seller is a union territory *without* its own
   *  legislature (Chandigarh, Ladakh, A&N, Lakshadweep, DN&DD): the PDF
   *  then labels the sgst halves as UTGST. SGST states leave it false. */
  usesUtgst?: boolean;
  /** Place of supply per Rule 46: for goods, the state the delivery is
   *  made in (i.e. the buyer address). Optional on older snapshots. */
  placeOfSupply?: {
    state: string;
    /** Official two-digit GST code, e.g. "36" for Telangana. */
    numericCode: string;
    /** Postal abbreviation, e.g. "TS". */
    code: string;
  };
  issuedAt: FirebaseFirestore.Timestamp;
}

export interface InvoiceCounterDoc {
  fiscalYear: string;
  nextSeq: number;
}

/** Delivery Challan line item (one artwork per challan in practice;
 *  shape is an array so a future multi-piece consignment doesn't need
 *  a schema migration). */
export interface DeliveryChallanLine {
  /** Artwork master id (ART-XXXXXX). */
  artworkId: string;
  title: string;
  artistName: string;
  medium: string | null;
  /** HSN for art is "9701". */
  hsn: string;
  qty: number;
  /** "No." by default. */
  unit: string;
  /** Artist's own price in paise (what GZ would pay if sold at base). */
  artistValuePaise: number;
  /** Listed selling price in paise — the "provisional" declared value
   *  used by insurers and NIC e-way bill. Marked-up from artist value
   *  by the platform commission layer. */
  provisionalValuePaise: number;
}

/** Party on a delivery challan — consignor (GalleryZone), dispatched-
 *  from (artist studio or aggregator venue), or consignee (aggregator
 *  venue or artist studio for returns). Frozen at stamp time. */
export interface DeliveryChallanParty {
  legalName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  /** Postal abbreviation like "TS". Null when state isn't resolvable. */
  stateCode: string | null;
  /** GSTIN when registered; null prints as "Unregistered". */
  gstin: string | null;
}

/** Why the consignment is moving. CGST-recognised vocabulary. */
export type DeliveryChallanReason =
  | "sale_on_approval"
  | "exhibition_display"
  | "return_of_goods"
  | "job_work";

/** Mode of transport, maps 1:1 to NIC e-way bill portal values. */
export type DeliveryChallanTransportMode =
  | "Road"
  | "Rail"
  | "Air"
  | "Ship"
  | "Courier";

/** Lives on OrderDoc or AggregatorHoldingDoc so the challan number
 *  can't drift across reads. Rule 55 requires in-transit documentation
 *  for every goods movement that isn't a supply (display, rotation,
 *  returns); the snapshot is what Shiprocket's courier physically
 *  carries in the parcel. */
export interface DeliveryChallanSnapshot {
  /** "GZ/DC/26-27/000001". Globally unique per fiscal year. */
  number: string;
  fiscalYear: string;
  /** When the challan was first stamped. */
  challanDate: FirebaseFirestore.Timestamp;
  /** Which of the three physical copies this render is for. Shiprocket
   *  gets Duplicate (for transporter); consignor keeps Triplicate;
   *  consignee signs Original on receipt. We stamp once and render the
   *  requested copy on demand. */
  copyLabel: "Original" | "Duplicate" | "Triplicate";
  reason: DeliveryChallanReason;
  /** 6-month display-and-approval deadline per GST Section 31(7). Null
   *  on return legs where no further deadline applies. */
  returnDeadline: FirebaseFirestore.Timestamp | null;
  /** Shorter current window — e.g. aggregator placement of 30 days,
   *  distinct from the overall 6-month cycle. */
  currentDeadline: FirebaseFirestore.Timestamp | null;
  /** E-Way Bill Part A — filled by our ClearTax integration (Phase 2).
   *  All fields null today; renderer prints "NA" when number is null. */
  ewayBill: {
    /** 12-digit EWB number from NIC via ClearTax, or null. */
    number: string | null;
    generatedAt: FirebaseFirestore.Timestamp | null;
    validUntil: FirebaseFirestore.Timestamp | null;
  };
  transport: {
    mode: DeliveryChallanTransportMode;
    transporterName: string;
    /** Vehicle registration, AWB number, or docket number. */
    vehicleOrDocket: string;
  };
  /** Consignor / Billed-From — always GalleryZone (the issuing party). */
  consignor: DeliveryChallanParty;
  /** Physical origin where the courier picks up (artist studio for the
   *  artist→aggregator leg; aggregator venue for returns). */
  dispatchedFrom: DeliveryChallanParty;
  /** Delivery destination (aggregator venue; artist studio for
   *  returns). */
  consignee: DeliveryChallanParty;
  items: DeliveryChallanLine[];
  /** Optional free-text instructions ("fragile, do not stack"). */
  notes?: string | null;
}

/** Fiscal-year counter for the delivery-challan numbering series.
 *  Same shape as InvoiceCounterDoc but a separate collection since
 *  the two series are legally distinct. */
export interface DeliveryChallanCounterDoc {
  fiscalYear: string;
  nextSeq: number;
}

/** GalleryZone's own identity on a payment voucher — the registered
 *  recipient/payer that's issuing the voucher to the artist. Separate
 *  from `SellerIdentity` only because this schema file can't import
 *  types from the apps layer (one-way dependency). Mirrors the shape
 *  exactly. */
export interface PurchaseBillPayer {
  legalName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  stateCode: string;
  pan: string;
}

/** The artist being paid. GST status is a literal string ("Unregistered
 *  (Below Threshold)" or a GSTIN, etc.) because Rule 52 wants it
 *  printed verbatim, not computed on the render side. */
export interface PurchaseBillPayee {
  fullName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  pan: string | null;
  phone: string | null;
  gstStatus: string;
}

/** Line 1 context — the artwork the payout is against. */
export interface PurchaseBillArtwork {
  id: string;
  title: string;
  medium: string | null;
  /** Always "9701" today (art HSN). Snapshot anyway in case we ever
   *  sell other HSN categories. */
  hsn: string;
}

/** Lives on OrderDoc. Stamped on the artist-settlement release path
 *  and never rewritten. Every field is frozen because Rule 52 payment
 *  vouchers participate in the artist's GST / income-tax filings; a
 *  later profile edit must not back-date the record. */
export interface PurchaseBillSnapshot {
  /** "GZ/PV/26-27/000001". Globally unique per fiscal year. */
  number: string;
  fiscalYear: string;
  /** "marketplace" → only TDS + platform-facilitation deductions.
   *  "aggregator" → adds Convenience (SAC 998599), Technology
   *  (SAC 998319), Service GST @18%, Delivery deductions. */
  channel: "marketplace" | "aggregator";
  voucherDate: FirebaseFirestore.Timestamp;
  /** NEFT / UPI / Cheque / RTGS / Wallet — stamped from the actual
   *  payout rail at release time. */
  paymentMode: "NEFT" | "RTGS" | "UPI" | "Cheque" | "Wallet";
  /** Bank UTR or RazorpayX payout id — audit trail for the artist. */
  paymentRef: string;
  /** Buyer-side order id the payout is against. */
  orderNumber: string;
  /** The customer tax invoice number that corresponds to this payout.
   *  Null if the order hasn't had its tax invoice downloaded yet
   *  (stamp happens on first invoice download); rare in practice. */
  customerInvoiceNumber: string | null;
  payer: PurchaseBillPayer;
  payee: PurchaseBillPayee;
  artwork: PurchaseBillArtwork;
  /** Aggregator venue name when channel === "aggregator" — printed as
   *  context on Line 1. */
  soldViaAggregator?: string | null;
  /** All amounts in paise. Mirrors the renderer's shape 1:1 so the
   *  stamp function can hand the snapshot straight to the renderer. */
  amounts: {
    artistPayoutShare: number;
    tds: number;
    platformFacilitation: number;
    convenience: number;
    convenienceGst: number;
    technology: number;
    technologyGst: number;
    otherCharges: number;
    otherChargesGst: number;
    delivery: number;
    rcmGst: number;
    netPayable: number;
  };
  /** Supply classification (payer state vs payee state) for the service
   *  rows. True → half-split (CGST + SGST), false → IGST single. */
  intraState: boolean;
  issuedAt: FirebaseFirestore.Timestamp;
}

/** Fiscal-year counter for the payment-voucher series. */
export interface PaymentVoucherCounterDoc {
  fiscalYear: string;
  nextSeq: number;
}

/** Fiscal-year counter for the aggregator-commission-invoice series
 *  ("GZ/AC/26-27/000001"). One doc per fiscal year; sequence is
 *  allocated in a Firestore transaction, same pattern as invoices and
 *  payment vouchers. */
export interface AggregatorCommissionInvoiceCounterDoc {
  fiscalYear: string;
  nextSeq: number;
}

/**
 * Snapshot of an aggregator commission tax invoice — the self-invoice
 * GalleryZone generates on behalf of the aggregator for their tier
 * share of the markup pool (MOU 9.6 v2026.4). Stored on the aggregator
 * sale doc; the renderer in the api layer owns the "live" Date-based
 * shape and this type is the Firestore-Timestamp variant written to
 * disk.
 *
 * Idempotent — once stamped the fields never change except for the
 * `acceptance` block, which is written by the aggregator tapping
 * "I agree" in the settlement portal.
 */
export interface AggregatorCommissionInvoiceDocSnapshot {
  number: string;
  fiscalYear: string;
  issuedAt: FirebaseFirestore.Timestamp;
  dueDate: FirebaseFirestore.Timestamp;
  servicePeriod: {
    from: FirebaseFirestore.Timestamp;
    to: FirebaseFirestore.Timestamp;
  };
  aggregator: {
    legalName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    stateCode: string;
    numericCode: string;
    phone: string | null;
    email: string | null;
    pan: string | null;
    gstin: string | null;
  };
  billedTo: {
    legalName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    gstin: string;
    stateCode: string;
    pan: string;
  };
  sale: {
    artworkId: string;
    artworkTitle: string;
    artistName: string;
    medium: string | null;
    customerInvoiceNumber: string;
    saleDate: FirebaseFirestore.Timestamp;
    listedSellingPaise: number;
    artistPaise: number;
  };
  commercialShare: {
    tier: 1 | 2 | 3;
    tierPercent: 20 | 35 | 50;
    markupPoolPaise: number;
    grossInclusivePaise: number;
  };
  taxBreakdown:
    | { kind: "intra_state"; taxablePaise: number; cgstPaise: number; sgstPaise: number; ratePercent: 18 }
    | { kind: "inter_state"; taxablePaise: number; igstPaise: number; ratePercent: 18 }
    | { kind: "unregistered"; taxablePaise: number; ratePercent: 0 };
  /** Null until the aggregator presses "I agree" — the PDF still
   *  renders, but with a "Pending acceptance" badge in place of the
   *  signature block. */
  acceptance: {
    acceptedAt: FirebaseFirestore.Timestamp;
    acceptedByIp: string;
    acceptedByUserAgent: string;
  } | null;
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
  /**
   * Razorpay's ACTUAL gateway fee for this specific payment, straight from the
   * `payment.captured` webhook (`payload.payment.entity.fee`). Varies by
   * instrument: UPI 0, debit <₹2k 0.4%, credit 2%, international 3%, etc. We
   * previously estimated a flat 2% + 18% GST at checkout — these fields let
   * the invoice (and admin reconciliation) show the true number.
   * Null on simulated / pre-capture / older payment docs that pre-date this field.
   */
  gatewayFeeActualPaise?: number | null;
  /** The GST Razorpay charged on the fee (same payload: `payload.payment.entity.tax`). */
  gatewayFeeGstActualPaise?: number | null;
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
  /**
   * What the settlement pays for. Absent on docs written before this field
   * existed — admin screens read absent as "sale" to stay backward
   * compatible. "artist_royalty" is the 2% owed to the artist on a resale
   * ownership transfer (see `markTransferFeePaid`); `transferId` names the
   * ownership event it came from.
   */
  kind?: "sale" | "artist_royalty";
  transferId?: string | null;
}

export interface WithdrawalRequestDoc {
  userId: string;
  amountPaise: number;
  status: WithdrawalStatus;
  requestedAt: FirebaseFirestore.Timestamp;
  processedAt: FirebaseFirestore.Timestamp | null;
  /** The admin who approved or rejected it. Absent on requests decided before this was recorded. */
  processedBy?: string | null;
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
  /** Return leg (aggregator → artist on an unsold return). Set by
   *  bookReturnShipment and advanced by the courier webhook under the
   *  `return-<holdingId>` reference. Absent on holdings that never
   *  returned. 9 Nov 2026. */
  returnShiprocketStage?: "pickup" | "in_transit" | "out_for_delivery" | "delivered" | null;
  returnTrackingId?: string | null;
  returnCarrier?: string | null;
  returnTrackedAt?: FirebaseFirestore.Timestamp | null;
  /** Artist asked for the piece back (end-of-6-month-listing path). Stamp
   *  so the UI can hide the button while the return is being arranged and
   *  admin can see artist-initiated vs system-return cases in the audit
   *  log. Stamped only AFTER the Razorpay payment is captured (not when
   *  the quote is created) — until then the artist can walk away without
   *  leaving dangling state. 16 Nov 2026. */
  artistReturnRequestedAt?: FirebaseFirestore.Timestamp | null;
  /** The last return-shipping quote we created for this holding. Kept
   *  so the UI can resume a half-paid attempt without re-quoting, and
   *  so the verify endpoint can tell which order it's verifying. */
  returnRazorpayOrderId?: string | null;
  /** Captured once the artist pays. Audit record for the reverse leg. */
  returnRazorpayPaymentId?: string | null;
  /** The Shiprocket quote this order was priced against. Paise. */
  returnShippingBasePaise?: number | null;
  /** 2% Razorpay gateway fee on the base. */
  returnConvenienceFeePaise?: number | null;
  /** 18% service GST on the convenience fee. */
  returnConvenienceGstPaise?: number | null;
  /** base + convenience + GST — what we charged Razorpay to collect. */
  returnShippingTotalPaise?: number | null;
  /** Where the artist asked to have the piece delivered. Mirrors the
   *  pickup-address shape the system uses elsewhere so the Shiprocket
   *  booking can lift it unchanged. */
  returnDropAddress?: {
    name: string;
    phone: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
  } | null;
  /** Rule 55 delivery challan for the ARTIST→AGGREGATOR inbound leg.
   *  Stamped by bookInboundShipment() just before the Shiprocket book
   *  call. The signed public URL of this challan is what Shiprocket's
   *  courier physically carries in the parcel as a substitute for the
   *  (non-existent) tax invoice — Rule 31(7) treats the movement as
   *  not-a-supply until the piece is sold. */
  deliveryChallan?: DeliveryChallanSnapshot | null;
  /** Rule 55 delivery challan for the AGGREGATOR→ARTIST return leg.
   *  Stamped by bookReturnShipment() when the aggregator returns an
   *  unsold piece. Separate field from the inbound challan because the
   *  consignor/consignee flip and the two numbers belong to different
   *  shipments that may need to be printed independently. */
  returnDeliveryChallan?: DeliveryChallanSnapshot | null;
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
  /** Structured delivery address — populated alongside the flat
   *  `deliveryAddress` string on sales recorded after 9 Nov 2026. Used by
   *  the Shiprocket aggregator-sale booking to resolve the drop party. */
  deliveryAddressLine1?: string | null;
  deliveryAddressLine2?: string | null;
  deliveryCity?: string | null;
  deliveryState?: string | null;
  deliveryPincode?: string | null;
  deliveryMode: "courier" | "self_pickup";
  paymentRoute: "direct_to_galleryzone" | "cash_at_premises";
  remittedAt: FirebaseFirestore.Timestamp | null;
  /** Cash sales: when the full price is due at GalleryZone. Absent on sales recorded before there was a deadline. */
  remitDueAt?: FirebaseFirestore.Timestamp | null;
  /** How the price was paid in: from the aggregator's wallet, by transfer to GalleryZone's bank, or through Razorpay. */
  remittedVia?: "wallet" | "bank" | "razorpay" | null;
  /** Set when the sale was paid in through a Razorpay remittance; points at the parent remittance doc. */
  remittanceId?: string | null;
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
  /** Admin coupon the aggregator applied at the counter. */
  couponCode?: string | null;
  /** Discount the coupon took off this sale, paise. Absorbed by platform revenue. */
  couponDiscountPaise?: number | null;
  /**
   * Self-invoice GZ generated on behalf of the aggregator for their
   * GST-inclusive tier share of the markup pool (MOU Clause 9.6 v2026.4).
   * Stamped lazily on first aggregator/admin download — until then the
   * invoice does not legally exist (no number has been allocated).
   * Acceptance is captured when the aggregator taps "I agree" in the
   * settlement portal. Absent on sales that recorded before 22 Nov 2026
   * or have had no download yet.
   */
  commissionInvoice?: AggregatorCommissionInvoiceDocSnapshot;
}

/**
 * One Razorpay-backed cash-remittance order, covering 1..N `cash_at_premises`
 * sales. The aggregator paid in GalleryZone's cash through Razorpay; the
 * webhook+verify path is the same hardened re-read pattern as orders and
 * top-ups. Marked `paid` is what stamps every sale listed under `saleIds` as
 * remitted — the whole batch settles atomically.
 */
export interface AggregatorRemittanceDoc {
  aggregatorId: string;
  saleIds: string[];
  amountPaise: number;
  status: "pending" | "paid" | "failed";
  providerOrderId: string | null;
  providerPaymentId: string | null;
  method: string | null;
  createdAt: FirebaseFirestore.Timestamp;
  paidAt: FirebaseFirestore.Timestamp | null;
}

/**
 * Shopping cart for the signed-in user, one doc per uid (doc id == uid).
 * The entries are a tiny shape — just artworkId + addedAt — so the browser
 * joins to the live artwork at render time; a sold or delisted piece falls
 * out naturally, and nothing goes stale in the cart.
 *
 * Moved from browser localStorage to Firestore on 31 Oct 2026 so the cart
 * syncs across devices (web + mobile parity). Max cap enforced server-side
 * so a tampered client can't fill the doc without bound.
 */
export interface CartEntry {
  artworkId: string;
  /** When the user ticked "add to cart". Drives the abandoned-cart sweep. */
  addedAt: FirebaseFirestore.Timestamp;
}

export interface CartDoc {
  userId: string; // == the Firestore doc ID (users/{uid}/cart would also work; one doc per uid keeps the write path simple)
  entries: CartEntry[];
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Saved artworks (wishlist) and followed artists for the signed-in user.
 * One doc per uid in each collection, same ownership rule as carts.
 *
 * Added 8 Nov 2026 — both were client-local on web and mobile, which meant
 * a saved piece was lost on reinstall and invisible on another device. The
 * entry shape mirrors CartEntry so the abandoned-wishlist sweep (not built
 * yet) can read them the same way.
 */
export interface WishlistEntry {
  artworkId: string;
  addedAt: FirebaseFirestore.Timestamp;
}

export interface WishlistDoc {
  userId: string;
  entries: WishlistEntry[];
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface FollowEntry {
  artistId: string;
  followedAt: FirebaseFirestore.Timestamp;
}

export interface FollowsDoc {
  userId: string;
  entries: FollowEntry[];
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * One in-flight OTP, keyed in Firestore by the SHA-256 hash of the channel
 * identifier (`email:you@example.com` or `phone:+919xxxxxxxxx`) so a second
 * request for the same identifier replaces the first. Codes are stored as
 * HMAC-SHA256 hashes, never plain — a dump of this collection cannot be
 * replayed to sign anybody in.
 *
 * Two separate counters: `attempts` is wrong-code tries (lock the OTP after
 * five), `sendsLastHour` is new-code requests (refuse a sixth within an hour
 * to stop SMS/email flooding).
 */
export interface OtpDoc {
  /** "email" or "phone" — picks the delivery channel + the attempt budget. */
  channel: "email" | "phone";
  /** The destination exactly as it was sent (not hashed), for the controller to
   *  compare the typed-in value against. The DOC ID is hashed; this isn't. */
  identifier: string;
  /** HMAC-SHA256(code, OTP_SECRET), base64. The plaintext code is never stored. */
  codeHash: string;
  /** 10 minutes after `createdAt`. The verify endpoint refuses an expired code
   *  even before checking the hash, so a timing side-channel can't leak hits. */
  expiresAt: FirebaseFirestore.Timestamp;
  /** Why the code was issued — the UI uses this to route after success. */
  purpose: "signup_email" | "signup_phone" | "password_reset";
  /** The uid this OTP is for, when known at send time. Password-reset codes
   *  carry it (we look up the account first); sign-up codes don't yet (the
   *  user isn't created until the email code verifies). */
  uid: string | null;
  /** Wrong-code tries so far. Five locks the OTP; a new /send resets it. */
  attempts: number;
  /** Successful `/send`s in the past hour. Caps at 5 — the sixth refuses. */
  sendsLastHour: number;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
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

/** One message from the public "Get in touch" form. See enquiries.ts. */
export interface EnquiryDoc {
  type: "advertisement" | "collaboration" | "general" | "support";
  name: string;
  email: string;
  senderRole: string;
  message: string;
  status: "new" | "handled";
  createdAt: FirebaseFirestore.Timestamp;
  handledAt: FirebaseFirestore.Timestamp | null;
  handledBy: string | null;
}

/** One admin announcement to a whole audience (artists, aggregators or both). See broadcasts.ts. */
export interface BroadcastDoc {
  title: string;
  body: string;
  audiences: string[];
  /** A path on the site the message points at, or null. */
  url: string | null;
  sentBy: string;
  sentAt: FirebaseFirestore.Timestamp;
  recipientCount: number;
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

/**
 * Admin-created marketplace coupon. Doc id is the code, lowercased, so
 * lookups are case-insensitive without a second index.
 *
 * Only marketplace checkout honours these in the MVP. Aggregator sales
 * are untouched because their price is already discounted through the
 * aggregator pricing ladder. Artists and aggregators never see a cut
 * to their payouts — the discount comes entirely out of GalleryZone's
 * platform revenue, which is the margin we have to give.
 */
export interface CouponDoc {
  /** Lowercased code, equal to the doc id. */
  code: string;
  /** "percent" takes value as a percent (0-100); "flat" takes value as paise. */
  kind: "percent" | "flat";
  /** Percent (0-100) or paise, by `kind`. */
  value: number;
  /** Floor: if the artwork's displayPrice is below this, the coupon refuses. Paise. Null = no floor. */
  minOrderPaise: number | null;
  /** Ceiling: a percent coupon never takes more than this. Paise. Null = no cap. */
  maxDiscountPaise: number | null;
  /** When the code goes live. */
  validFrom: FirebaseFirestore.Timestamp;
  /** When it expires. */
  validUntil: FirebaseFirestore.Timestamp;
  /** Total redemptions the code is good for, across all customers. */
  usageCap: number | null;
  /** How many times each customer may use this code. Null = unlimited per user. */
  perUserCap: number | null;
  /** Bumped inside the checkout transaction on a successful redemption. */
  usedCount: number;
  /** Which checkouts the code is honoured on. "both" works on either. */
  scope: "marketplace" | "aggregator" | "both";
  /** When present, restricts the coupon to pieces by these artists.
   *  Null = any artist. Case-sensitive uids. */
  artistIds: string[] | null;
  /** "active" (live), "paused" (admin took it offline), "expired" (past validUntil). */
  status: "active" | "paused" | "expired";
  /** Admin uid who created it. */
  createdBy: string;
  createdAt: FirebaseFirestore.Timestamp;
}

/**
 * A single redemption of a coupon. Lives at
 * `coupons/{code}/redemptions/{orderOrHoldingId}`. One doc per sale;
 * created inside the payment-capture transaction so usedCount and the
 * per-user-cap query stay in sync.
 */
export interface CouponRedemptionDoc {
  userId: string;
  channel: "marketplace" | "aggregator";
  /** paise taken off this sale. */
  discountPaise: number;
  redeemedAt: FirebaseFirestore.Timestamp;
  /** The order id (marketplace) or holding id (aggregator sale) this redemption belongs to. */
  refId: string;
}
