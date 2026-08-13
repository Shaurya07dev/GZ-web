import type { Artwork } from "@/types/artwork";
import type { Order } from "@/types/order";
import type {
  AdminActivityEvent,
  AdminKpis,
  AdminUser,
  AuditLogEntry,
  Category,
  GeneratedReport,
  GenerateReportInput,
  PlatformSettings,
  ReportType,
  Settlement,
  UserRole,
  UserStatus,
  WithdrawalRequest,
} from "@/types/admin";
import { mockArtworks } from "@/lib/mock-data/artworks";
import { mockOrders } from "@/lib/mock-data/customer";
import {
  defaultPlatformSettings,
  isInKycQueue,
  mockAdminActivity,
  mockAdminKpis,
  mockAdminUsers,
  mockAuditLog,
  mockCategories,
  mockPendingArtworks,
  mockReports,
  mockSettlements,
  mockWithdrawals,
} from "@/lib/mock-data/admin";
import { mockDelay, mockError } from "@/lib/mock-utils";
import { ADMIN } from "@/features/admin/admin-data";

// ---------------------------------------------------------------------------
// Mock admin service. Same contract as every other service in this codebase
// (customerService, aggregatorService): reads resolve fixture data after a
// fake delay, and mutations resolve a *plausible next value* WITHOUT mutating
// the shared fixture arrays. The visible change comes from the call site
// applying `queryClient.setQueryData` in the mutation hook's onSuccess — the
// pattern the Customer Account track established (see
// features/account/address-form-dialog.tsx). Fixtures stay read-only because
// they are shared with the public marketplace, and mutating them in place
// would leak admin side effects into pages admin doesn't own.
//
// Swapping any of this for a real axios call later is a same-shape change.
// ---------------------------------------------------------------------------

function findArtwork(id: string): Artwork | undefined {
  return mockArtworks.find((a) => a.id === id) ?? mockPendingArtworks.find((a) => a.id === id);
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  sales: "Marketplace sales",
  settlements: "Settlement register",
  artist_payouts: "Artist payouts",
  aggregator_commission: "Aggregator commission",
  gst: "GST summary",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function formatReportRange(from: string, to: string): string {
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
  return `${new Date(from).toLocaleDateString("en-IN", options)} – ${new Date(to).toLocaleDateString("en-IN", options)}`;
}

export const adminService = {
  // --- overview + analytics ------------------------------------------------
  getKpis: (): Promise<AdminKpis> => mockDelay(mockAdminKpis),

  getActivity: (): Promise<AdminActivityEvent[]> => mockDelay(mockAdminActivity),

  // --- moderation ----------------------------------------------------------
  listPendingArtworks: (): Promise<Artwork[]> =>
    mockDelay(mockPendingArtworks.filter((a) => a.status === "pending_approval")),

  // Resolves undefined (rather than rejecting) for an unknown id so the review
  // page can call notFound() on it, matching customerService.getProfile's shape.
  getPendingArtwork: (id: string): Promise<Artwork | undefined> =>
    mockDelay(mockPendingArtworks.find((a) => a.id === id)),

  approveArtwork: (id: string): Promise<{ id: string; status: "marketplace" }> => {
    if (!mockPendingArtworks.some((a) => a.id === id)) {
      return mockError(`Artwork "${id}" is not awaiting approval`);
    }
    return mockDelay({ id, status: "marketplace" as const });
  },

  rejectArtwork: (id: string, reason: string): Promise<{ id: string; status: "returned"; reason: string }> => {
    if (!mockPendingArtworks.some((a) => a.id === id)) {
      return mockError(`Artwork "${id}" is not awaiting approval`);
    }
    if (!reason.trim()) return mockError("A rejection reason is required");
    return mockDelay({ id, status: "returned" as const, reason });
  },

  // The queue definition (artists sitting in submitted / under_review) lives in
  // the fixture module so the table, the nav badge and the KPI tile can't drift.
  listKycQueue: (): Promise<AdminUser[]> => mockDelay(mockAdminUsers.filter(isInKycQueue)),

  approveKyc: (userId: string): Promise<{ userId: string; kycStatus: "approved" }> => {
    if (!mockAdminUsers.some((u) => u.id === userId)) return mockError(`User "${userId}" not found`);
    return mockDelay({ userId, kycStatus: "approved" as const });
  },

  rejectKyc: (
    userId: string,
    reason: string
  ): Promise<{ userId: string; kycStatus: "rejected"; reason: string }> => {
    if (!mockAdminUsers.some((u) => u.id === userId)) return mockError(`User "${userId}" not found`);
    if (!reason.trim()) return mockError("A rejection reason is required");
    return mockDelay({ userId, kycStatus: "rejected" as const, reason });
  },

  listWithdrawals: (): Promise<WithdrawalRequest[]> => mockDelay(mockWithdrawals),

  approveWithdrawal: (id: string): Promise<{ id: string; status: "completed" }> => {
    const withdrawal = mockWithdrawals.find((w) => w.id === id);
    if (!withdrawal) return mockError(`Withdrawal "${id}" not found`);
    if (withdrawal.status !== "pending") return mockError("Only pending withdrawals can be approved");
    return mockDelay({ id, status: "completed" as const });
  },

  rejectWithdrawal: (id: string, reason: string): Promise<{ id: string; status: "rejected"; reason: string }> => {
    const withdrawal = mockWithdrawals.find((w) => w.id === id);
    if (!withdrawal) return mockError(`Withdrawal "${id}" not found`);
    if (withdrawal.status !== "pending") return mockError("Only pending withdrawals can be rejected");
    if (!reason.trim()) return mockError("A rejection reason is required");
    return mockDelay({ id, status: "rejected" as const, reason });
  },

  // --- catalog -------------------------------------------------------------
  // Public + admin-only sets combined: admin is the one view that sees every
  // artwork regardless of status.
  listAllArtworks: (): Promise<Artwork[]> => mockDelay([...mockArtworks, ...mockPendingArtworks]),

  getArtworkAdmin: (id: string): Promise<Artwork | undefined> => mockDelay(findArtwork(id)),

  delistArtwork: (id: string): Promise<{ id: string; status: "returned" }> => {
    const artwork = findArtwork(id);
    if (!artwork) return mockError(`Artwork "${id}" not found`);
    return mockDelay({ id, status: "returned" as const });
  },

  listCategories: (): Promise<Category[]> => mockDelay(mockCategories),

  createCategory: (name: string): Promise<Category> => {
    const slug = slugify(name);
    if (!slug) return mockError("A category name is required");
    if (mockCategories.some((c) => c.slug === slug)) {
      return mockError(`A category with the slug "${slug}" already exists`);
    }
    return mockDelay({ id: `cat-${slug}`, name: name.trim(), slug, artworkCount: 0 });
  },

  updateCategory: (id: string, name: string): Promise<Category> => {
    const existing = mockCategories.find((c) => c.id === id);
    if (!existing) return mockError(`Category "${id}" not found`);
    const slug = slugify(name);
    if (!slug) return mockError("A category name is required");
    if (mockCategories.some((c) => c.id !== id && c.slug === slug)) {
      return mockError(`A category with the slug "${slug}" already exists`);
    }
    return mockDelay({ ...existing, name: name.trim(), slug });
  },

  // Guarded exactly as the spec requires: a category still holding artworks
  // cannot be deleted, and the rejection carries an explanation the UI can
  // surface inline rather than a bare failure.
  deleteCategory: (id: string): Promise<{ id: string }> => {
    const existing = mockCategories.find((c) => c.id === id);
    if (!existing) return mockError(`Category "${id}" not found`);
    if (existing.artworkCount > 0) {
      return mockError(
        `"${existing.name}" still has ${existing.artworkCount} artwork${existing.artworkCount === 1 ? "" : "s"}. Move or delist them before deleting the category.`
      );
    }
    return mockDelay({ id });
  },

  // --- people --------------------------------------------------------------
  listUsers: (role?: UserRole): Promise<AdminUser[]> =>
    mockDelay(role ? mockAdminUsers.filter((u) => u.role === role) : mockAdminUsers),

  getUser: (id: string): Promise<AdminUser | undefined> => mockDelay(mockAdminUsers.find((u) => u.id === id)),

  setUserStatus: (id: string, status: UserStatus): Promise<{ id: string; status: UserStatus }> => {
    if (!mockAdminUsers.some((u) => u.id === id)) return mockError(`User "${id}" not found`);
    return mockDelay({ id, status });
  },

  // --- commerce ------------------------------------------------------------
  listOrders: (): Promise<Order[]> => mockDelay(mockOrders),

  listSettlements: (): Promise<Settlement[]> => mockDelay(mockSettlements),

  retrySettlement: (id: string): Promise<{ id: string; status: "processed" }> => {
    const settlement = mockSettlements.find((s) => s.id === id);
    if (!settlement) return mockError(`Settlement "${id}" not found`);
    if (settlement.status !== "failed") return mockError("Only failed settlements can be retried");
    return mockDelay({ id, status: "processed" as const });
  },

  // --- system --------------------------------------------------------------
  listAuditLog: (): Promise<AuditLogEntry[]> => mockDelay(mockAuditLog),

  getSettings: (): Promise<PlatformSettings> => mockDelay(defaultPlatformSettings),

  updateSettings: (patch: Partial<PlatformSettings>): Promise<PlatformSettings> =>
    mockDelay({ ...defaultPlatformSettings, ...patch }),

  listReports: (): Promise<GeneratedReport[]> => mockDelay(mockReports),

  generateReport: (input: GenerateReportInput): Promise<GeneratedReport> => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return mockError("Enter a valid date range");
    }
    if (to.getTime() < from.getTime()) return mockError("The end date must fall after the start date");

    // Row count is a plausible stand-in derived from the range length — there
    // is no ledger to count, and pretending otherwise would be a fake number
    // dressed up as a real one.
    const spanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1);
    return mockDelay({
      id: `rpt-${crypto.randomUUID().slice(0, 8)}`,
      type: input.type,
      label: `${REPORT_TYPE_LABELS[input.type]} — ${formatReportRange(input.from, input.to)}`,
      from: input.from,
      to: input.to,
      generatedAt: new Date().toISOString(),
      generatedBy: ADMIN.name,
      rowCount: Math.round(spanDays * 1.8),
      status: "ready" as const,
    });
  },
};
