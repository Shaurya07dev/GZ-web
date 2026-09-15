import {
  ARTWORK_EDIT_WINDOW_DAYS,
  EXTERNAL_SALE_PENALTY_RATE,
  isPenaltyCollectable,
  WITHDRAWABLE_STATUSES,
  artworkEditState,
  type Artwork,
  type ArtworkImage,
  type ArtworkPhysical,
  type ExternalSalePenalty,
} from "@/types/artwork";
import type { AggregatorHolding } from "@/types/aggregator";
import type { Order } from "@/types/order";
import type { DeactivationRequest, Settlement } from "@/types/admin";
import { mockDelay, mockError } from "@/lib/mock-utils";
import { http } from "@/lib/api";
import { paiseToRupees, toOrder, type OrderDto } from "@/lib/api-mappers";
import { artistArtworkApi, toOwnerArtwork, type OwnerArtworkDto, type SubmitImage } from "@/services/artistArtworkApi";
import { artistWalletApi } from "@/services/artistWalletApi";
import { profileApi, type OwnProfileDto, type OwnProfilePatch } from "@/services/profileApi";

// The shape the dashboard's profile/KYC screens were written against.
export interface ArtistProfileView {
  fullName: string;
  email: string;
  phone: string;
  bio: string;
  instagram: string;
  website: string;
  bankAccountMasked: string;
  /** Write-only: never returned by the API. */
  bankAccountNumber?: string;
  ifsc: string;
  aadhaarStatus: "not_submitted" | "submitted" | "approved" | "rejected";
  aadhaarMasked: string;
  gstin: string;
  pan: string | null;
  gstStatus: "not_submitted" | "submitted" | "approved" | "rejected";
  socialProofVideoUrl: string | null;
  pickupLine1: string;
  pickupLine2: string;
  pickupCity: string;
  pickupState: string;
  pickupPincode: string;
  location: string | null;
  headline: string | null;
  joinedAt: string;
}

function toArtistProfileView(p: OwnProfileDto): ArtistProfileView {
  return {
    fullName: p.fullName,
    email: p.email,
    phone: p.phone ?? "",
    bio: p.bio ?? "",
    instagram: p.instagram ?? "",
    website: p.website ?? "",
    bankAccountMasked: p.bankAccountMasked ?? "",
    ifsc: p.ifsc ?? "",
    aadhaarStatus: p.aadhaarStatus,
    aadhaarMasked: p.aadhaarMasked ?? "",
    gstin: p.gstin ?? "",
    pan: p.pan,
    gstStatus: p.gstStatus,
    socialProofVideoUrl: p.socialProofVideoUrl,
    pickupLine1: p.pickupLine1 ?? "",
    pickupLine2: p.pickupLine2 ?? "",
    pickupCity: p.pickupCity ?? "",
    pickupState: p.pickupState ?? "",
    pickupPincode: p.pickupPincode ?? "",
    location: p.location,
    headline: p.headline,
    joinedAt: p.createdAt,
  };
}
import { authService } from "@/services/authService";
import { MOU_VERSION } from "@/features/dashboard/mou-data";

/** Wire shape from apps/api mou.controller.ts. */
interface MouAcceptanceDto {
  party: "artist" | "aggregator";
  version: string;
  signatureName: string;
  signatureDataUrl: string | null;
  acceptedAt: string;
}
import {
  artworksCol,
  pendingArtworksCol,
  artistWalletCol,
  artistWalletTransactionsCol,
  artistActivityCol,
  artistProfileCol,
  artistPricesCol,
  artistSettlementsCol,
  artistSettingsCol,
  artistPenaltiesCol,
  deactivationRequestsCol,
  ordersCol,
  holdingsCol,
  CURRENT_ARTIST_ID,
  CURRENT_ARTIST_NAME,
  KPI_METRICS,
} from "@/lib/mock-collections";
import { displayPriceOf } from "@/lib/pricing";
import {
  pendingArtistSettlements,
  releaseDueArtistSettlements,
  simulateDeliveryAndRelease,
} from "./artistPayoutService";
import type {
  ActivityEntry,
  ActivityKind,
  WalletTransaction,
} from "@/features/dashboard/dashboard-data";

// Mock service for the Artist Dashboard, following the same Page -> Hook ->
// Service pattern as aggregatorService/adminService — the one track that
// predated that convention and read straight from a static fixture module
// instead. Everything here reads/writes lib/mock-collections.ts, so a
// submission actually lands in the admin moderation queue and a withdrawal
// actually moves the wallet balance.

function artistArtworks(): Artwork[] {
  return [...artworksCol.get(), ...pendingArtworksCol.get()].filter(
    (a) => a.artistId === CURRENT_ARTIST_ID,
  );
}

function appendActivity(kind: ActivityKind, title: string, detail: string) {
  const entry: ActivityEntry = {
    id: `act-${crypto.randomUUID().slice(0, 8)}`,
    kind,
    title,
    detail,
    time: "Just now",
  };
  artistActivityCol.set([entry, ...artistActivityCol.get()]);
}

// A fee an artist owes for selling a piece elsewhere is collected the next
// time they actually list something — drafts don't trigger it. Charged as a
// wallet adjustment; the balance floors at 0 because there's no
// negative-balance/recovery flow in the mock.
//
// Only fees an admin has APPROVED are collected. One still awaiting review, or
// waived, is passed over — the artist is never charged for a decision nobody
// has made.
function settlePendingPenalties(listingTitle: string) {
  const outstanding = artistPenaltiesCol.get().filter(isPenaltyCollectable);
  if (outstanding.length === 0) return;

  const now = new Date().toISOString();
  const total = outstanding.reduce((sum, penalty) => sum + penalty.amount, 0);
  const settledIds = new Set(outstanding.map((penalty) => penalty.id));

  artistPenaltiesCol.set(
    artistPenaltiesCol
      .get()
      .map((penalty) =>
        settledIds.has(penalty.id) ? { ...penalty, settledAt: now } : penalty,
      ),
  );

  const wallet = artistWalletCol.get();
  artistWalletCol.set({
    ...wallet,
    balance: Math.max(0, wallet.balance - total),
  });

  const transaction: WalletTransaction = {
    id: `wt-${crypto.randomUUID().slice(0, 8)}`,
    type: "adjustment",
    label: `Off-platform sale fee (${outstanding.length} artwork${outstanding.length > 1 ? "s" : ""}), charged on "${listingTitle}"`,
    amount: -total,
    date: now.slice(0, 10),
    status: "completed",
  };
  artistWalletTransactionsCol.set([
    transaction,
    ...artistWalletTransactionsCol.get(),
  ]);

  appendActivity(
    "settlement",
    "Off-platform sale fee charged",
    `₹${total.toLocaleString("en-IN")} deducted with your new listing.`,
  );
}

export interface ArtworkKpiMetric {
  key: string;
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  icon: (typeof KPI_METRICS)[number]["icon"];
}

export interface SubmitArtworkInput {
  title: string;
  description: string;
  category: string;
  medium: string;
  artworkType: string | null;
  paintingStyle: string | null;
  dimensions: string | null;
  yearCreated: number;
  artistPrice: number;
  listingType: Artwork["listingType"];
  insuranceOpted: boolean;
  insuranceNumber: string | null;
  physical: ArtworkPhysical;
  nfcTagId: string | null;
  images: SubmitImage[];
  mode: "draft" | "review";
}

// A number is "submitted" the moment it's entered — GalleryZone verifies it
// from there. Re-entering the same number after approval doesn't reset
// review; entering a different one (or clearing it) does.
function nextInsuranceStatus(
  current: Artwork["insuranceStatus"],
  previousNumber: string | null | undefined,
  nextNumber: string | null,
): NonNullable<Artwork["insuranceStatus"]> {
  if (!nextNumber) return "not_submitted";
  if (current === "approved" && nextNumber === previousNumber)
    return "approved";
  return "submitted";
}


interface PenaltyDto {
  id: string;
  artworkId: string;
  artworkTitle: string;
  amountPaise: number;
  status: "pending_review" | "approved" | "waived";
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  settledAt: string | null;
}
function toPenalty(p: PenaltyDto): ExternalSalePenalty {
  return { id: p.id, artworkId: p.artworkId, artworkTitle: p.artworkTitle, amount: paiseToRupees(p.amountPaise), createdAt: p.createdAt, settledAt: p.settledAt, status: p.status, decidedAt: p.decidedAt, decisionNote: p.decisionNote };
}
interface DeactivationDto {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
}
function toDeactivation(d: DeactivationDto): DeactivationRequest {
  return { ...d, userRole: "artist" };
}

export const artistDashboardService = {
  getKpiMetrics: async (): Promise<ArtworkKpiMetric[]> => {
    const [wallet, artworks, transactions] = await Promise.all([
      artistWalletApi.getWallet(),
      artistArtworkApi.list(),
      artistWalletApi.listTransactions(),
    ]);
    const pendingCount = artworks.filter((a) => a.status === "pending_approval").length;
    const soldCount = artworks.filter((a) => ["sold", "settlement_complete", "delivered", "completed"].includes(a.status)).length;
    const revenue = transactions.filter((t) => t.type === "settlement" && t.status === "completed").reduce((sum, t) => sum + Math.max(0, t.amount), 0);
    return [
      {
        ...KPI_METRICS[0],
        value: `₹${revenue.toLocaleString("en-IN")}`,
        delta: soldCount > 0 ? `${soldCount} ${soldCount === 1 ? "sale" : "sales"} settled` : "No sales settled yet",
        positive: soldCount > 0,
      },
      {
        ...KPI_METRICS[1],
        value: `₹${wallet.balance.toLocaleString("en-IN")}`,
        delta:
          wallet.lockedBalance > 0
            ? `₹${wallet.lockedBalance.toLocaleString("en-IN")} withdrawal pending`
            : "Available to withdraw",
      },
      {
        ...KPI_METRICS[2],
        value: String(pendingCount),
        delta: pendingCount > 0 ? "Awaiting admin review" : "All caught up",
      },
    ];
  },

  // Derived from real events: artwork status history and wallet
  // transactions, newest first. No stored feed — nothing to drift.
  getActivity: async (): Promise<ActivityEntry[]> => {
    const [artworks, transactions] = await Promise.all([artistArtworkApi.list(), artistWalletApi.listTransactions()]);
    const entries: ActivityEntry[] = [];
    for (const a of artworks) {
      for (const e of a.statusHistory) {
        if (e.status === "pending_approval") entries.push({ id: `${a.id}:${e.changedAt}:sub`, kind: "artwork_submitted", title: "Submitted for review", detail: `"${a.title}" is with the curation team`, time: e.changedAt });
        else if (e.status === "marketplace") entries.push({ id: `${a.id}:${e.changedAt}:live`, kind: "artwork_approved", title: "Artwork approved", detail: `"${a.title}" is live on the marketplace`, time: e.changedAt });
        else if (e.status === "returned") entries.push({ id: `${a.id}:${e.changedAt}:ret`, kind: "artwork_submitted", title: "Artwork returned", detail: `"${a.title}" needs changes before it can be listed`, time: e.changedAt });
        else if (e.status === "sold") entries.push({ id: `${a.id}:${e.changedAt}:sold`, kind: "settlement", title: "Artwork sold", detail: `"${a.title}" has a buyer`, time: e.changedAt });
      }
    }
    for (const t of transactions) {
      if (t.type === "withdrawal") entries.push({ id: `wt:${t.id}`, kind: "withdrawal", title: t.status === "pending" ? "Withdrawal requested" : "Withdrawal processed", detail: `₹${Math.abs(t.amount).toLocaleString("en-IN")} · ${t.label}`, time: t.date });
      else if (t.type === "settlement") entries.push({ id: `wt:${t.id}`, kind: "settlement", title: "Settlement credited", detail: `₹${t.amount.toLocaleString("en-IN")} · ${t.label}`, time: t.date });
    }
    return entries.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 30);
  },

  // Artwork CRUD is real (services/artistArtworkApi.ts): the API, with the
  // image pipeline. The rest of this file is still the mock and is being
  // replaced method by method.
  listArtworks: (): Promise<Array<Artwork & { artistPrice: number }>> =>
    artistArtworkApi.list(),

  getArtwork: (artworkId: string): Promise<Artwork & { artistPrice: number }> =>
    artistArtworkApi.get(artworkId),

  submitArtwork: (input: SubmitArtworkInput): Promise<Artwork> => {
    if (!input.title.trim()) return Promise.reject(new Error("A title is required"));
    if (input.artistPrice <= 0) return Promise.reject(new Error("Enter your price for this artwork"));
    return artistArtworkApi.submit(input);
  },

  updateArtwork: (input: {
    artworkId: string;
    patch: Omit<SubmitArtworkInput, "mode">;
    mode?: "draft" | "review";
  }): Promise<Artwork> => {
    if (!input.patch.title.trim()) return Promise.reject(new Error("A title is required"));
    if (input.patch.artistPrice <= 0) return Promise.reject(new Error("Enter your price for this artwork"));
    return artistArtworkApi.update({ artworkId: input.artworkId, patch: input.patch, ...(input.mode ? { mode: input.mode } : {}) });
  },

  // "Sold on another platform": the piece leaves every GalleryZone channel at
  // once, and a fee of EXTERNAL_SALE_PENALTY_RATE of its listed price is raised
  // for review. It is NOT charged here and not charged automatically later —
  // an admin decides whether it stands, and only then does it come out of the
  // next listing (settlePendingPenalties above).
  markSoldElsewhere: async (artworkId: string): Promise<Artwork> => {
    const { artwork } = await http.post<{ artwork: OwnerArtworkDto | null }>(`/v1/artist/artworks/${encodeURIComponent(artworkId)}/sold-elsewhere`);
    if (!artwork) throw new Error("Artwork not found");
    return toOwnerArtwork(artwork);
  },

  listPenalties: async (): Promise<ExternalSalePenalty[]> => {
    const { penalties } = await http.get<{ penalties: PenaltyDto[] }>("/v1/artist/penalties");
    return penalties.map(toPenalty);
  },

  // Settlements are released lazily rather than on a timer: reading the wallet
  // is the only moment the 7-days-after-delivery rule is observable, and this
  // mock has no scheduler to run it any other way.
  // Wallet is real (services/artistWalletApi.ts). "pending" = settled
  // sales still inside the payout clock is not modelled by the ledger yet,
  // so pendingBalance is 0; locked = withdrawal requests awaiting approval.
  getWallet: (): Promise<{
    balance: number;
    pendingBalance: number;
    lockedBalance: number;
  }> => artistWalletApi.getWallet(),

  listWalletTransactions: (): Promise<WalletTransaction[]> =>
    artistWalletApi.listTransactions(),

  /** Sales waiting on the 7-day post-delivery clock. */
  listPendingSettlements: (): Promise<Settlement[]> =>
    mockDelay(pendingArtistSettlements()),

  /** Demo shortcut — nothing in this app marks a customer order delivered. */
  simulateDelivery: (settlementId: string): Promise<void> => {
    simulateDeliveryAndRelease(settlementId);
    return mockDelay(undefined);
  },

  requestWithdrawal: (amount: number): Promise<WalletTransaction> => {
    if (amount < 1000) return Promise.reject(new Error("Minimum withdrawal is ₹1,000"));
    return artistWalletApi.requestWithdrawal(amount);
  },

  // The profile record is still mock-backed (no backend write route for
  // PAN/GST/bank details yet), but two things on it are real: the identity
  // (name/email from GET /v1/auth/me — the MOU signature has to match the
  // account's real name) and the signed MOU record (GET /v1/artist/mou).
  // An acceptance for an older MOU version is reported as null, which is
  // what makes a newly published MOU require a fresh signature.
  // The account's own profile (GET /v1/me/profile) plus the signed MOU
  // record (GET /v1/artist/mou). An acceptance for an older MOU version is
  // reported as null, which is what makes a newly published MOU require a
  // fresh signature.
  getProfile: async () => {
    const [p, mou] = await Promise.all([
      profileApi.get(),
      http.get<{ acceptance: MouAcceptanceDto | null }>("/v1/artist/mou"),
    ]);
    const acceptance = mou.acceptance;
    return {
      ...toArtistProfileView(p),
      mouAcceptance:
        acceptance && acceptance.version === MOU_VERSION
          ? {
              acceptedAt: acceptance.acceptedAt,
              signatureName: acceptance.signatureName,
              version: acceptance.version,
              signatureDataUrl: acceptance.signatureDataUrl,
            }
          : null,
    };
  },

  // Signing the MOU is its own call rather than a profile patch: the server
  // records the signing time and the version, checks the typed name against
  // the account, and never lets an ordinary profile save overwrite it.
  acceptMou: async (input: {
    signatureName: string;
    version: string;
    signatureDataUrl?: string | null;
  }) => {
    const acceptance = await http.post<MouAcceptanceDto>("/v1/artist/mou/accept", {
      version: input.version,
      signatureName: input.signatureName.trim(),
      signatureDataUrl: input.signatureDataUrl ?? null,
    });
    appendActivity(
      "verification",
      "MOU signed",
      `Memorandum of Understanding v${acceptance.version} accepted`,
    );
    return {
      ...toArtistProfileView(await profileApi.get()),
      mouAcceptance: {
        acceptedAt: acceptance.acceptedAt,
        signatureName: acceptance.signatureName,
        version: acceptance.version,
        signatureDataUrl: acceptance.signatureDataUrl,
      },
    };
  },

  updateProfile: async (patch: Partial<ArtistProfileView>) => {
    const body: OwnProfilePatch = {};
    if (patch.fullName !== undefined) body.fullName = patch.fullName;
    if (patch.phone !== undefined) body.phone = patch.phone || null;
    if (patch.bio !== undefined) body.bio = patch.bio || null;
    if (patch.instagram !== undefined) body.instagram = patch.instagram || null;
    if (patch.website !== undefined) body.website = patch.website || null;
    if (patch.socialProofVideoUrl !== undefined) body.socialProofVideoUrl = patch.socialProofVideoUrl || null;
    if (patch.pan !== undefined) body.pan = patch.pan || null;
    if (patch.gstin !== undefined) body.gstin = patch.gstin || null;
    if (patch.ifsc !== undefined) body.ifsc = patch.ifsc || null;
    if (patch.bankAccountNumber !== undefined) body.bankAccountNumber = patch.bankAccountNumber || null;
    for (const key of ["pickupLine1", "pickupLine2", "pickupCity", "pickupState", "pickupPincode"] as const) {
      if (patch[key] !== undefined) body[key] = patch[key] || null;
    }
    const updated = toArtistProfileView(await profileApi.update(body));
    const mou = await http.get<{ acceptance: MouAcceptanceDto | null }>("/v1/artist/mou");
    const acceptance = mou.acceptance;
    return {
      ...updated,
      mouAcceptance:
        acceptance && acceptance.version === MOU_VERSION
          ? { acceptedAt: acceptance.acceptedAt, signatureName: acceptance.signatureName, version: acceptance.version, signatureDataUrl: acceptance.signatureDataUrl }
          : null,
    };
  },

  listOrders: async (): Promise<Array<Order & { artistPayout: number }>> => {
    const { orders } = await http.get<{ orders: (OrderDto & { artistNetPaise: number })[] }>("/v1/artist/orders");
    return orders.map((o) => ({ ...toOrder(o), artistPayout: paiseToRupees(o.artistNetPaise) }));
  },

  listSettlements: (): Promise<Settlement[]> =>
    mockDelay(artistSettlementsCol.get()),

  listGallerySpaces: (): Promise<
    Array<AggregatorHolding & { artwork: Artwork }>
  > => {
    const artworkById = new Map(artistArtworks().map((a) => [a.id, a]));
    return mockDelay(
      holdingsCol
        .get()
        .filter((holding) => artworkById.has(holding.artworkId))
        .map((holding) => ({
          ...holding,
          artwork: artworkById.get(holding.artworkId)!,
        })),
    );
  },

  // --- Account deactivation ------------------------------------------------
  // Asking is all the artist can do. An admin decides, because a closing
  // account may still owe a settlement, hold a piece with an aggregator, or
  // have a transfer someone is waiting to accept.

  getDeactivationRequest: async (): Promise<DeactivationRequest | null> => {
    const { request } = await http.get<{ request: DeactivationDto | null }>("/v1/artist/deactivation");
    return request ? toDeactivation(request) : null;
  },

  requestDeactivation: async (input: { reason: string }): Promise<DeactivationRequest> => {
    if (!input.reason.trim()) throw new Error("Tell us why you're leaving so an admin can review it");
    await http.post("/v1/artist/deactivation", { reason: input.reason.trim() });
    const { request } = await http.get<{ request: DeactivationDto | null }>("/v1/artist/deactivation");
    if (!request) throw new Error("The request was not recorded");
    return toDeactivation(request);
  },

  // Withdrawing a pending request isn't a backend operation yet; an admin
  // rejecting it has the same effect. Surfaced as an error, not a silent no-op.
  withdrawDeactivation: async (_requestId: string): Promise<{ id: string }> => {
    throw new Error("Contact support to withdraw a pending deactivation request");
  },

  getSettings: () => mockDelay(artistSettingsCol.get()),

  updateSettings: (
    patch: Partial<ReturnType<typeof artistSettingsCol.get>>,
  ) => {
    const updated = { ...artistSettingsCol.get(), ...patch };
    artistSettingsCol.set(updated);
    return mockDelay(updated);
  },
};
