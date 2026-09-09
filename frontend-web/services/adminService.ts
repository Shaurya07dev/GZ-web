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
  getKpis: (): Promise<AdminKpis> => {
    const pendingArtworks = pendingArtworksCol.get();
    const adminUsers = adminUsersCol.get();
    return mockDelay({
      ...mockAdminKpis,
      activeArtworks: artworksCol
        .get()
        .filter((a) => a.status === "marketplace").length,
      totalUsers: adminUsers.length,
      pendingArtworkApprovals: pendingArtworks.filter(
        (a) => a.status === "pending_approval",
      ).length,
      pendingKyc: adminUsers.filter(isInKycQueue).length,
      pendingWithdrawals: mockWithdrawals.filter((w) => w.status === "pending")
        .length,
    });
  },

  getActivity: (): Promise<AdminActivityEvent[]> =>
    mockDelay(mockAdminActivity),

  // --- moderation ----------------------------------------------------------
  listPendingArtworks: (): Promise<Artwork[]> =>
    mockDelay(
      pendingArtworksCol.get().filter((a) => a.status === "pending_approval"),
    ),

  // Resolves undefined (rather than rejecting) for an unknown id so the review
  // page can call notFound() on it, matching customerService.getProfile's shape.
  getPendingArtwork: (id: string): Promise<Artwork | undefined> =>
    mockDelay(pendingArtworksCol.get().find((a) => a.id === id)),

  approveArtwork: (
    id: string,
  ): Promise<{ id: string; status: "marketplace" }> => {
    const pending = pendingArtworksCol.get();
    const artwork = pending.find((a) => a.id === id);
    if (!artwork || artwork.status !== "pending_approval") {
      return mockError(`Artwork "${id}" is not awaiting approval`);
    }
    const now = new Date().toISOString();
    const approved: Artwork = {
      ...artwork,
      status: "marketplace",
      statusHistory: [
        ...artwork.statusHistory,
        { status: "marketplace" as const, changedAt: now },
      ],
    };
    pendingArtworksCol.set(pending.filter((a) => a.id !== id));
    artworksCol.set([...artworksCol.get(), approved]);
    return mockDelay({ id, status: "marketplace" as const });
  },

  rejectArtwork: (
    id: string,
    reason: string,
  ): Promise<{ id: string; status: "returned"; reason: string }> => {
    const pending = pendingArtworksCol.get();
    const artwork = pending.find((a) => a.id === id);
    if (!artwork || artwork.status !== "pending_approval") {
      return mockError(`Artwork "${id}" is not awaiting approval`);
    }
    if (!reason.trim()) return mockError("A rejection reason is required");
    const now = new Date().toISOString();
    const updated: Artwork = {
      ...artwork,
      status: "returned",
      statusHistory: [
        ...artwork.statusHistory,
        { status: "returned" as const, changedAt: now },
      ],
    };
    pendingArtworksCol.set(pending.map((a) => (a.id === id ? updated : a)));
    return mockDelay({ id, status: "returned" as const, reason });
  },

  // The queue definition (artists sitting in submitted / under_review) lives in
  // the fixture module so the table, the nav badge and the KPI tile can't drift.
  listKycQueue: (): Promise<AdminUser[]> =>
    mockDelay(adminUsersCol.get().filter(isInKycQueue)),

  approveKyc: (
    userId: string,
  ): Promise<{ userId: string; kycStatus: "approved" }> => {
    if (!adminUsersCol.get().some((u) => u.id === userId))
      return mockError(`User "${userId}" not found`);
    return mockDelay({ userId, kycStatus: "approved" as const });
  },

  rejectKyc: (
    userId: string,
    reason: string,
  ): Promise<{ userId: string; kycStatus: "rejected"; reason: string }> => {
    if (!adminUsersCol.get().some((u) => u.id === userId))
      return mockError(`User "${userId}" not found`);
    if (!reason.trim()) return mockError("A rejection reason is required");
    return mockDelay({ userId, kycStatus: "rejected" as const, reason });
  },

  // GST is an artist-only requirement — see profile-kyc-form.tsx and
  // lib/mock-data/admin.ts's isInGstQueue for the queue definition.
  listGstQueue: (): Promise<AdminUser[]> =>
    mockDelay(adminUsersCol.get().filter(isInGstQueue)),

  approveGst: (
    userId: string,
  ): Promise<{ userId: string; gstStatus: "approved" }> => {
    if (!adminUsersCol.get().some((u) => u.id === userId))
      return mockError(`User "${userId}" not found`);
    return mockDelay({ userId, gstStatus: "approved" as const });
  },

  rejectGst: (
    userId: string,
    reason: string,
  ): Promise<{ userId: string; gstStatus: "rejected"; reason: string }> => {
    if (!adminUsersCol.get().some((u) => u.id === userId))
      return mockError(`User "${userId}" not found`);
    if (!reason.trim()) return mockError("A rejection reason is required");
    return mockDelay({ userId, gstStatus: "rejected" as const, reason });
  },

  listWithdrawals: (): Promise<WithdrawalRequest[]> =>
    mockDelay(mockWithdrawals),

  approveWithdrawal: (
    id: string,
  ): Promise<{ id: string; status: "completed" }> => {
    const withdrawal = mockWithdrawals.find((w) => w.id === id);
    if (!withdrawal) return mockError(`Withdrawal "${id}" not found`);
    if (withdrawal.status !== "pending")
      return mockError("Only pending withdrawals can be approved");
    return mockDelay({ id, status: "completed" as const });
  },

  rejectWithdrawal: (
    id: string,
    reason: string,
  ): Promise<{ id: string; status: "rejected"; reason: string }> => {
    const withdrawal = mockWithdrawals.find((w) => w.id === id);
    if (!withdrawal) return mockError(`Withdrawal "${id}" not found`);
    if (withdrawal.status !== "pending")
      return mockError("Only pending withdrawals can be rejected");
    if (!reason.trim()) return mockError("A rejection reason is required");
    return mockDelay({ id, status: "rejected" as const, reason });
  },

  // --- off-platform sale fees ----------------------------------------------
  // The 1% fee is proposed by the system and decided by a person. Selling
  // elsewhere is not automatically bad faith, so nothing is charged until this
  // runs; artistDashboardService only collects fees marked approved.

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
  listAllArtworks: (): Promise<Artwork[]> =>
    mockDelay([...artworksCol.get(), ...pendingArtworksCol.get()]),

  getArtworkAdmin: (id: string): Promise<Artwork | undefined> =>
    mockDelay(findArtwork(id)),

  delistArtwork: (id: string): Promise<{ id: string; status: "returned" }> => {
    const artwork = findArtwork(id);
    if (!artwork) return mockError(`Artwork "${id}" not found`);
    return mockDelay({ id, status: "returned" as const });
  },

  // The live placement for a piece, if it has one. Returned holdings are kept
  // for the cycle counter, so "with an aggregator right now" is specifically
  // the reserved one.
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
  setArtworkRarity: (
    id: string,
    rarity: ArtworkRarity | null,
  ): Promise<Artwork> => {
    const artwork = findArtwork(id);
    if (!artwork) return mockError(`Artwork "${id}" not found`);

    const updated: Artwork = { ...artwork, rarityType: rarity };
    const replace = (list: Artwork[]) =>
      list.map((a) => (a.id === id ? updated : a));

    if (artworksCol.get().some((a) => a.id === id)) {
      artworksCol.set(replace(artworksCol.get()));
    }
    if (pendingArtworksCol.get().some((a) => a.id === id)) {
      pendingArtworksCol.set(replace(pendingArtworksCol.get()));
    }
    return mockDelay(updated);
  },

  // Same read/write shape as setArtworkRarity — an artist's submitted policy
  // number sits with an admin until they mark it approved or rejected.
  setArtworkInsuranceStatus: (
    id: string,
    insuranceStatus: NonNullable<Artwork["insuranceStatus"]>,
  ): Promise<Artwork> => {
    const artwork = findArtwork(id);
    if (!artwork) return mockError(`Artwork "${id}" not found`);

    const updated: Artwork = { ...artwork, insuranceStatus };
    const replace = (list: Artwork[]) =>
      list.map((a) => (a.id === id ? updated : a));

    if (artworksCol.get().some((a) => a.id === id)) {
      artworksCol.set(replace(artworksCol.get()));
    }
    if (pendingArtworksCol.get().some((a) => a.id === id)) {
      pendingArtworksCol.set(replace(pendingArtworksCol.get()));
    }
    return mockDelay(updated);
  },

  listCategories: (): Promise<Category[]> => mockDelay(mockCategories),

  createCategory: (name: string): Promise<Category> => {
    const slug = slugify(name);
    if (!slug) return mockError("A category name is required");
    if (mockCategories.some((c) => c.slug === slug)) {
      return mockError(`A category with the slug "${slug}" already exists`);
    }
    return mockDelay({
      id: `cat-${slug}`,
      name: name.trim(),
      slug,
      artworkCount: 0,
    });
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
        `"${existing.name}" still has ${existing.artworkCount} artwork${existing.artworkCount === 1 ? "" : "s"}. Move or delist them before deleting the category.`,
      );
    }
    return mockDelay({ id });
  },

  // --- people --------------------------------------------------------------
  listUsers: (role?: UserRole): Promise<AdminUser[]> =>
    mockDelay(
      role
        ? adminUsersCol.get().filter((u) => u.role === role)
        : adminUsersCol.get(),
    ),

  getUser: (id: string): Promise<AdminUser | undefined> =>
    mockDelay(adminUsersCol.get().find((u) => u.id === id)),

  setUserStatus: (
    id: string,
    status: UserStatus,
  ): Promise<{ id: string; status: UserStatus }> => {
    if (!adminUsersCol.get().some((u) => u.id === id))
      return mockError(`User "${id}" not found`);
    return mockDelay({ id, status });
  },

  // Person-detail pages need more than the bare AdminUser row. These three
  // bundle exactly what each detail page renders, through the service layer
  // instead of the page importing lib/mock-data/* fixtures directly.
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
  listOrders: (): Promise<Order[]> => mockDelay(ordersCol.get()),

  getOrderAdmin: (id: string): Promise<Order | undefined> =>
    mockDelay(ordersCol.get().find((o) => o.id === id)),

  getAddressAdmin: (id: string): Promise<Address | undefined> =>
    mockDelay(addressesCol.get().find((a) => a.id === id)),

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
  listAuditLog: (): Promise<AuditLogEntry[]> => mockDelay(mockAuditLog),

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
