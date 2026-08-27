import type { ArtworkStatus } from "./artwork";
import type { OrderStatus } from "./order";

export type UserRole = "artist" | "aggregator" | "customer" | "admin";
export type UserStatus = "pending" | "active" | "suspended" | "blocked";
export type KycStatus =
  "pending" | "submitted" | "under_review" | "approved" | "rejected";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string; // ISO
  lastLoginAt: string | null;
  kycStatus?: KycStatus; // artists and aggregators only
  companyName?: string; // aggregators only
}

export type WithdrawalStatus = "pending" | "completed" | "rejected" | "failed";

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  userRole: Extract<UserRole, "artist" | "aggregator">;
  amount: number; // >= 1000 per platform rule
  bankAccountMasked: string; // e.g. "XXXXXXXX1234" — never a full number
  walletBalance: number;
  status: WithdrawalStatus;
  requestedAt: string;
  processedAt: string | null;
}

export type SettlementStatus = "pending" | "processed" | "failed";

export interface Settlement {
  id: string;
  orderId: string;
  artworkTitle: string;
  artistName: string;
  artistAmount: number;
  aggregatorCommission: number;
  platformRevenue: number;
  status: SettlementStatus;
  createdAt: string;
  processedAt: string | null;
  // The money-flow sheets pay the artist 7 days after DELIVERY, not after the
  // sale. This is stamped when the piece is delivered; null means nothing has
  // been delivered yet, so no clock is running. Optional because the fixture
  // settlements predate the field.
  releaseAfter?: string | null;
  /** Links to the artist wallet row this settlement created, so releasing the
   *  money can flip that row from pending to completed. */
  walletTransactionId?: string;
}

// --- Account deactivation ----------------------------------------------------

// Closing an account is not self-service: the artist asks, an admin decides.
// Listings, certificates and ownership records outlive the account, so someone
// has to look at what is outstanding before the door closes.
export type DeactivationStatus = "pending" | "approved" | "rejected";

export interface DeactivationRequest {
  id: string;
  userId: string;
  userName: string;
  userRole: Extract<UserRole, "artist">;
  reason: string;
  status: DeactivationStatus;
  requestedAt: string;
  decidedAt: string | null;
  /** Why an admin refused, shown back to the artist. */
  decisionNote: string | null;
}

export type AuditAction =
  | "artwork.approved"
  | "artwork.rejected"
  | "artwork.delisted"
  | "artwork.ranked"
  | "artwork.rank_cleared"
  | "kyc.approved"
  | "kyc.rejected"
  | "withdrawal.approved"
  | "withdrawal.rejected"
  | "user.suspended"
  | "user.activated"
  | "category.created"
  | "category.updated"
  | "category.deleted"
  | "settlement.retried"
  | "settings.updated";

export interface AuditLogEntry {
  id: string;
  adminName: string;
  action: AuditAction;
  entityType:
    "artwork" | "user" | "withdrawal" | "category" | "settlement" | "settings";
  entityId: string;
  entityLabel: string; // human-readable, e.g. the artwork title
  detail?: string; // e.g. a rejection reason
  createdAt: string; // ISO
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  artworkCount: number;
}

export interface PlatformSettings {
  markupPercent: number; // 30
  gstPercent: number; // 5
  minWithdrawalAmount: number; // 1000
  insuranceThreshold: number; // 20000
  aggregatorCommissionPercent: number; // 20 (of the markup)
}

export interface AdminKpis {
  gmv: number;
  platformRevenue: number;
  artistPayouts: number;
  totalOrders: number;
  activeArtworks: number;
  totalUsers: number;
  pendingArtworkApprovals: number;
  pendingKyc: number;
  pendingWithdrawals: number;
}

export interface AdminActivityEvent {
  id: string;
  label: string;
  detail: string;
  at: string; // ISO
  kind: "artwork" | "order" | "user" | "withdrawal" | "settlement";
}

export type AdminArtworkStatusFilter = ArtworkStatus | "all";
export type AdminOrderStatusFilter = OrderStatus | "all";

// ---------------------------------------------------------------------------
// Reports (/admin/reports, plan Task 16). Not enumerated in the plan's Task 1
// type block, but adminService.listReports/generateReport (Task 2) cannot be
// typed without them, so they live here with every other admin type rather
// than being redeclared ad hoc at three separate call sites.
// ---------------------------------------------------------------------------

export type ReportType =
  "sales" | "settlements" | "artist_payouts" | "aggregator_commission" | "gst";

export interface GeneratedReport {
  id: string;
  type: ReportType;
  label: string;
  from: string; // ISO date (inclusive)
  to: string; // ISO date (inclusive)
  generatedAt: string; // ISO
  generatedBy: string; // admin name
  rowCount: number;
  // "ready" rows are still not downloadable in a mock build — Task 16 must
  // label the download affordance honestly rather than linking to nothing.
  status: "ready" | "generating";
}

export interface GenerateReportInput {
  type: ReportType;
  from: string;
  to: string;
}
