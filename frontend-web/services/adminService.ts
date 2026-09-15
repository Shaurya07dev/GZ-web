import {
  penaltyStatus,
  type Artwork,
  type ArtworkRarity,
  type ExternalSalePenalty,
} from "@/types/artwork";
import type { Order } from "@/types/order";
import type { ArtistProfile } from "@/types/artist";
import type {
  AdminActivityEvent,
  AdminKpis,
  AdminUser,
  AuditLogEntry,
  Category,
  DeactivationRequest,
  GeneratedReport,
  GenerateReportInput,
  PlatformSettings,
  ReportType,
  Settlement,
  UserRole,
  UserStatus,
  WithdrawalRequest,
} from "@/types/admin";
import type { Address } from "@/types/customer";
import type { AggregatorHolding } from "@/types/aggregator";
import { mockArtists } from "@/lib/mock-data/artists";
import { getArtworksByArtist } from "@/lib/mock-data/helpers";
import {
  defaultPlatformSettings,
  isInKycQueue,
  isInGstQueue,
  mockAdminActivity,
  mockAdminKpis,
  mockAuditLog,
  mockCategories,
  mockReports,
  mockSettlements,
  mockWithdrawals,
} from "@/lib/mock-data/admin";
import { mockDelay, mockError } from "@/lib/mock-utils";
import { adminApi } from "@/services/adminApi";
import { ADMIN } from "@/features/admin/admin-data";
import { aggregatorService } from "@/services/aggregatorService";
import {
  addressesCol,
  adminUsersCol,
  aggregatorWalletCol,
  aggregatorWalletTransactionsCol,
  artistPenaltiesCol,
  deactivationRequestsCol,
  artworksCol,
  holdingsCol,
  ordersCol,
  pendingArtworksCol,
} from "@/lib/mock-collections";

// ---------------------------------------------------------------------------
// Mock admin service. Reads/writes for the moderation → catalog pipeline
// (pending artworks, the marketplace catalog, admin users, orders, addresses)
// go through lib/mock-collections.ts, so an approval here actually shows up
// on the Marketplace and in the Artist Dashboard, and survives a refresh.
// Everything else (withdrawals, categories, settlements, audit log, settings,
// reports) keeps the original mock contract — reads resolve fixture data,
// mutations resolve a *plausible next value* WITHOUT persisting it, exactly
// like customerService/aggregatorService document. Those pages already work
// correctly via TanStack Query's optimistic setQueryData (the audit log page
// additionally has its own live-append store, store/useAdminAuditStore) and
// sit outside the artist → admin → marketplace → checkout loop this
// persistence layer exists to support.
//
// Swapping any of this for a real axios call later is a same-shape change.
// ---------------------------------------------------------------------------

function findArtwork(id: string): Artwork | undefined {
  return (
    artworksCol.get().find((a) => a.id === id) ??
    pendingArtworksCol.get().find((a) => a.id === id)
  );
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
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  };
  return `${new Date(from).toLocaleDateString("en-IN", options)} – ${new Date(to).toLocaleDateString("en-IN", options)}`;
}

// An approved closure suspends the account. The request stores the artist id
// ("devika-rao"); admin records key on the user id ("user-artist-devika-rao"),
// so match on the suffix rather than assuming one prefix.
function deactivateUser(artistId: string): void {
  const users = adminUsersCol.get();
  adminUsersCol.set(
    users.map((user) =>
      user.id.endsWith(artistId) ? { ...user, status: "suspended" } : user,
    ),
  );
}

export const adminService = {
  // --- overview + analytics ------------------------------------------------
  // gmv/platformRevenue/artistPayouts/totalOrders stay the seeded 12-month
  // analytics aggregates (see lib/mock-data/admin.ts's own comment on why —
  // deriving them from the handful of live orders would require hundreds of
  // fabricated rows). The four queue-sized counters are recomputed live so
  // every KPI tile agrees with the table/queue it links to.
  getKpis: (): Promise<AdminKpis> => adminApi.getKpis(),

  // Derived from the audit log and recent orders — no stored feed.
  getActivity: async (): Promise<AdminActivityEvent[]> => {
    const [audit, orders] = await Promise.all([adminApi.listAuditLog(), adminApi.listOrders()]);
    const events: AdminActivityEvent[] = audit.map((a) => ({
      id: `audit:${a.id}`,
      label: a.action.replace(/[._]/g, " "),
      detail: a.entityLabel,
      at: a.createdAt,
      kind: a.entityType === "artwork" ? "artwork" : a.entityType === "withdrawal" ? "withdrawal" : a.entityType === "settlement" ? "settlement" : "user",
    }));
    for (const o of orders.slice(0, 20)) {
      events.push({ id: `order:${o.id}`, label: o.status === "pending" ? "Order started" : `Order ${o.status}`, detail: o.artwork?.title ?? o.artworkId, at: o.createdAt, kind: "order" });
    }
    return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
  },

  // --- moderation ----------------------------------------------------------
  listPendingArtworks: (): Promise<Artwork[]> => adminApi.listPendingArtworks(),

  getPendingArtwork: (id: string): Promise<Artwork | undefined> => adminApi.getArtwork(id),

  approveArtwork: (id: string): Promise<{ id: string; status: "marketplace" }> => adminApi.approveArtwork(id),

  rejectArtwork: (id: string, reason: string): Promise<{ id: string; status: "returned"; reason: string }> => {
    if (!reason.trim()) return Promise.reject(new Error("A rejection reason is required"));
    return adminApi.rejectArtwork(id, reason);
  },

  listKycQueue: (): Promise<AdminUser[]> => adminApi.listKycQueue(),

  approveKyc: async (userId: string): Promise<{ userId: string; kycStatus: "approved" }> => {
    await adminApi.decideKyc(userId, "approve");
    return { userId, kycStatus: "approved" as const };
  },

  rejectKyc: async (userId: string, reason: string): Promise<{ userId: string; kycStatus: "rejected"; reason: string }> => {
    if (!reason.trim()) throw new Error("A rejection reason is required");
    await adminApi.decideKyc(userId, "reject", reason);
    return { userId, kycStatus: "rejected" as const, reason };
  },

  listGstQueue: (): Promise<AdminUser[]> => adminApi.listGstQueue(),

  approveGst: async (userId: string): Promise<{ userId: string; gstStatus: "approved" }> => {
    await adminApi.decideGst(userId, "approve");
    return { userId, gstStatus: "approved" as const };
  },

  rejectGst: async (userId: string, reason: string): Promise<{ userId: string; gstStatus: "rejected"; reason: string }> => {
    if (!reason.trim()) throw new Error("A rejection reason is required");
    await adminApi.decideGst(userId, "reject", reason);
    return { userId, gstStatus: "rejected" as const, reason };
  },

  listWithdrawals: (): Promise<WithdrawalRequest[]> => adminApi.listWithdrawals(),

  approveWithdrawal: (id: string): Promise<{ id: string; status: "completed" }> => adminApi.approveWithdrawal(id),

  rejectWithdrawal: (id: string, reason: string): Promise<{ id: string; status: "rejected"; reason: string }> => {
    if (!reason.trim()) return Promise.reject(new Error("A rejection reason is required"));
    return adminApi.rejectWithdrawal(id, reason);
  },

  listExternalSaleFees: (): Promise<ExternalSalePenalty[]> =>
    mockDelay(
      [...artistPenaltiesCol.get()].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    ),

  decideExternalSaleFee: (input: {
    id: string;
    approve: boolean;
    note?: string;
  }): Promise<ExternalSalePenalty> => {
    const all = artistPenaltiesCol.get();
    const penalty = all.find((p) => p.id === input.id);
    if (!penalty) return mockError(`Fee "${input.id}" not found`);
    if (penaltyStatus(penalty) !== "pending_review")
      return mockError("That fee has already been decided");

    const decided: ExternalSalePenalty = {
      ...penalty,
      status: input.approve ? "approved" : "waived",
      decidedAt: new Date().toISOString(),
      decisionNote: input.note?.trim() ?? null,
    };
    artistPenaltiesCol.set(all.map((p) => (p.id === input.id ? decided : p)));
    return mockDelay(decided);
  },

  // --- account deactivation ------------------------------------------------
  // The artist asks from their settings page; this is the deciding end.
  // Approving suspends the account, which is what the Artists table already
  // renders — no second notion of "closed" is invented here.

  listDeactivationRequests: (): Promise<DeactivationRequest[]> =>
    mockDelay(
      [...deactivationRequestsCol.get()].sort((a, b) =>
        b.requestedAt.localeCompare(a.requestedAt),
      ),
    ),

  decideDeactivation: (input: {
    id: string;
    approve: boolean;
    note?: string;
  }): Promise<DeactivationRequest> => {
    const all = deactivationRequestsCol.get();
    const request = all.find((r) => r.id === input.id);
    if (!request) return mockError(`Request "${input.id}" not found`);
    if (request.status !== "pending")
      return mockError("That request has already been decided");
    if (!input.approve && !input.note?.trim())
      return mockError("A reason is required when refusing a closure");

    const decided: DeactivationRequest = {
      ...request,
      status: input.approve ? "approved" : "rejected",
      decidedAt: new Date().toISOString(),
      decisionNote: input.note?.trim() ?? null,
    };
    deactivationRequestsCol.set(
      all.map((r) => (r.id === input.id ? decided : r)),
    );

    if (input.approve) {
      // The admin user id carries a "user-" prefix, and the demo artist's
      // carries "user-artist-" — match on the suffix rather than rebuilding it.
      deactivateUser(request.userId);
    }

    return mockDelay(decided);
  },

  // --- catalog -------------------------------------------------------------
  // Public + admin-only sets combined: admin is the one view that sees every
  // artwork regardless of status.
  listAllArtworks: (): Promise<Artwork[]> => adminApi.listAllArtworks(),

  getArtworkAdmin: (id: string): Promise<Artwork | undefined> => adminApi.getArtwork(id),

  delistArtwork: (id: string): Promise<{ id: string; status: "returned" }> => adminApi.delistArtwork(id),

  activeHoldingFor: (
    artworkId: string,
  ): Promise<AggregatorHolding | null> =>
    mockDelay(
      holdingsCol.get().find(
        (h) => h.artworkId === artworkId && h.status === "reserved",
      ) ?? null,
    ),

  // GalleryZone reclaiming a piece from an aggregator mid-placement. Distinct
  // from the aggregator returning it themselves: same end state for the
  // artwork, different question about the money.
  //
  // An unsold return costs the aggregator the delivery leg — the money-flow
  // sheet settles that only on a sale. But that rule describes an aggregator
  // who held the piece and did not sell it, not one whose piece was taken back
  // by GalleryZone partway through. Rather than guess which way the client
  // reads it, the admin decides per case, the same way they already decide an
  // off-platform sale fee. `reason` is required: an aggregator whose stock
  // disappears is owed an explanation.
  pullBackHolding: (input: {
    holdingId: string;
    reason: string;
    refundDelivery: boolean;
  }): Promise<{ released: number; deliveryCharged: number }> => {
    const holdings = holdingsCol.get();
    const holding = holdings.find((h) => h.id === input.holdingId);
    if (!holding) return mockError("That placement no longer exists");
    if (holding.status !== "reserved")
      return mockError(
        holding.status === "returned"
          ? "This piece has already come back"
          : "This piece has sold — it cannot be pulled back",
      );
    if (!input.reason.trim())
      return mockError("Say why the piece is being pulled back");

    const artwork = findArtwork(holding.artworkId);
    const title = artwork?.title ?? "Artwork";
    const delivery = holding.deliveryDeposit ?? 0;
    const deliveryCharged = input.refundDelivery ? 0 : delivery;
    const held = holding.advanceAmount + delivery;
    const now = new Date().toISOString();

    // The advance and delivery were LOCKED from the aggregator's wallet, never
    // taken, so the whole hold is released here and only the forfeited portion
    // actually leaves the balance.
    const wallet = aggregatorWalletCol.get();
    aggregatorWalletCol.set({
      ...wallet,
      lockedBalance: Math.max(0, wallet.lockedBalance - held),
      balance: wallet.balance - deliveryCharged,
    });

    aggregatorWalletTransactionsCol.set([
      {
        id: `wt-${crypto.randomUUID().slice(0, 8)}`,
        type: "refund" as const,
        label: `Advance released: "${title}" pulled back by GalleryZone`,
        amount: holding.advanceAmount,
        date: now.slice(0, 10),
        status: "completed" as const,
      },
      ...(deliveryCharged > 0
        ? [
            {
              id: `wt-${crypto.randomUUID().slice(0, 8)}`,
              type: "adjustment" as const,
              label: `Delivery charged — "${title}" pulled back`,
              amount: -deliveryCharged,
              date: now.slice(0, 10),
              status: "completed" as const,
            },
          ]
        : []),
      ...aggregatorWalletTransactionsCol.get(),
    ]);

    // Kept rather than deleted, like every other return: the next aggregator's
    // price and advance are counted off how many placements this piece has
    // already been through, and a pull-back is one of them.
    holdingsCol.set(
      holdings.map((h) =>
        h.id === input.holdingId
          ? { ...h, status: "returned" as const, returnedAt: now }
          : h,
      ),
    );

    return mockDelay({
      released: holding.advanceAmount + (delivery - deliveryCharged),
      deliveryCharged,
    });
  },

  // GalleryZone ranks the work, the artist does not. The rank is written back
  // to whichever collection actually holds the piece — a work still awaiting
  // approval lives in pendingArtworksCol, and ranking it there is the point:
  // an admin reviewing a submission is exactly when they judge it.
  setArtworkRarity: (id: string, rarity: ArtworkRarity | null): Promise<Artwork> => adminApi.setArtworkRarity(id, rarity),

  setArtworkInsuranceStatus: (id: string, insuranceStatus: NonNullable<Artwork["insuranceStatus"]>): Promise<Artwork> => {
    if (insuranceStatus !== "approved" && insuranceStatus !== "rejected") return Promise.reject(new Error("Only approve or reject can be recorded"));
    return adminApi.setArtworkInsuranceStatus(id, insuranceStatus);
  },

  listCategories: (): Promise<Category[]> => adminApi.listCategories(),

  createCategory: (name: string): Promise<Category> => adminApi.createCategory(name),

  updateCategory: (id: string, name: string): Promise<Category> => adminApi.updateCategory(id, name),

  deleteCategory: (id: string): Promise<{ id: string }> => adminApi.deleteCategory(id),

  listUsers: (role?: UserRole): Promise<AdminUser[]> => adminApi.listUsers(role),

  getUser: (id: string): Promise<AdminUser | undefined> => adminApi.getUser(id),

  setUserStatus: (id: string, status: UserStatus): Promise<{ id: string; status: UserStatus }> => adminApi.setUserStatus(id, status),

  getArtistPortfolio: (
    userId: string,
  ): Promise<
    | {
        user: AdminUser;
        profile: ArtistProfile | undefined;
        artworks: Artwork[];
      }
    | undefined
  > => {
    const user = adminUsersCol
      .get()
      .find((u) => u.id === userId && u.role === "artist");
    if (!user) return mockDelay(undefined);
    const profile = mockArtists.find((a) => a.name === user.name);
    const artworks = profile ? getArtworksByArtist(profile.id) : [];
    return mockDelay({ user, profile, artworks });
  },

  // Holdings aren't partitioned per aggregator in this mock (same shortcut
  // the original page took) — every current holding is shown against
  // whichever aggregator's detail page is open.
  getAggregatorPortfolio: async (
    userId: string,
  ): Promise<
    | {
        user: AdminUser;
        holdings: Awaited<ReturnType<typeof aggregatorService.listCollection>>;
        commissionPercent: number;
      }
    | undefined
  > => {
    const user = adminUsersCol
      .get()
      .find((u) => u.id === userId && u.role === "aggregator");
    if (!user) return undefined;
    const holdings = await aggregatorService.listCollection();
    return {
      user,
      holdings,
      commissionPercent: defaultPlatformSettings.aggregatorCommissionPercent,
    };
  },

  // Orders aren't partitioned per customer in this mock either (mockOrders is
  // a single-customer sample) — same shortcut as the aggregator portfolio.
  getCustomerPortfolio: (
    userId: string,
  ): Promise<
    { user: AdminUser; orders: Order[]; addresses: Address[] } | undefined
  > => {
    const user = adminUsersCol
      .get()
      .find((u) => u.id === userId && u.role === "customer");
    if (!user) return mockDelay(undefined);
    return mockDelay({
      user,
      orders: ordersCol.get(),
      addresses: addressesCol.get(),
    });
  },

  // --- commerce ------------------------------------------------------------
  listOrders: (): Promise<Order[]> => adminApi.listOrders(),

  getOrderAdmin: (id: string): Promise<Order | undefined> => adminApi.getOrder(id),

  getAddressAdmin: (id: string): Promise<Address | undefined> => adminApi.getAddress(id),

  getSettlementByOrder: (orderId: string): Promise<Settlement | undefined> =>
    mockDelay(mockSettlements.find((s) => s.orderId === orderId)),

  listSettlements: (): Promise<Settlement[]> => mockDelay(mockSettlements),

  retrySettlement: (
    id: string,
  ): Promise<{ id: string; status: "processed" }> => {
    const settlement = mockSettlements.find((s) => s.id === id);
    if (!settlement) return mockError(`Settlement "${id}" not found`);
    if (settlement.status !== "failed")
      return mockError("Only failed settlements can be retried");
    return mockDelay({ id, status: "processed" as const });
  },

  // --- system --------------------------------------------------------------
  listAuditLog: (): Promise<AuditLogEntry[]> => adminApi.listAuditLog(),

  getSettings: (): Promise<PlatformSettings> =>
    mockDelay(defaultPlatformSettings),

  updateSettings: (
    patch: Partial<PlatformSettings>,
  ): Promise<PlatformSettings> =>
    mockDelay({ ...defaultPlatformSettings, ...patch }),

  listReports: (): Promise<GeneratedReport[]> => mockDelay(mockReports),

  generateReport: (input: GenerateReportInput): Promise<GeneratedReport> => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return mockError("Enter a valid date range");
    }
    if (to.getTime() < from.getTime())
      return mockError("The end date must fall after the start date");

    // Row count is a plausible stand-in derived from the range length — there
    // is no ledger to count, and pretending otherwise would be a fake number
    // dressed up as a real one.
    const spanDays = Math.max(
      1,
      Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1,
    );
    return mockDelay({
      id: `rpt-${crypto.randomUUID().slice(0, 8)}`,
      type: input.type,
      label: `${REPORT_TYPE_LABELS[input.type]} (${formatReportRange(input.from, input.to)})`,
      from: input.from,
      to: input.to,
      generatedAt: new Date().toISOString(),
      generatedBy: ADMIN.name,
      rowCount: Math.round(spanDays * 1.8),
      status: "ready" as const,
    });
  },
};
