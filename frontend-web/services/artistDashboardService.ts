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
import { artistArtworkApi, type SubmitImage } from "@/services/artistArtworkApi";
import { artistWalletApi } from "@/services/artistWalletApi";
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

  getActivity: (): Promise<ActivityEntry[]> =>
    mockDelay(artistActivityCol.get()),

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
  markSoldElsewhere: (artworkId: string): Promise<Artwork> => {
    const inLive = artworksCol.get().find((a) => a.id === artworkId);
    const inPending = pendingArtworksCol.get().find((a) => a.id === artworkId);
    const artwork = inLive ?? inPending;

    if (!artwork || artwork.artistId !== CURRENT_ARTIST_ID)
      return mockError("Artwork not found");
    if (artwork.status === "sold_externally")
      return mockError("This artwork is already marked as sold elsewhere");
    if (!WITHDRAWABLE_STATUSES.has(artwork.status))
      return mockError(
        "This artwork is already claimed on GalleryZone and can no longer be withdrawn",
      );

    const now = new Date().toISOString();
    const updated: Artwork = {
      ...artwork,
      status: "sold_externally",
      statusHistory: [
        ...artwork.statusHistory,
        { status: "sold_externally", changedAt: now },
      ],
      custody: {
        legalOwner: "customer",
        custodian: "customer",
        locationLabel: "Sold outside GalleryZone",
      },
    };

    const replace = (list: Artwork[]) =>
      list.map((a) => (a.id === artworkId ? updated : a));
    if (inLive) artworksCol.set(replace(artworksCol.get()));
    if (inPending) pendingArtworksCol.set(replace(pendingArtworksCol.get()));

    const penalty: ExternalSalePenalty = {
      id: `pen-${crypto.randomUUID().slice(0, 8)}`,
      artworkId,
      artworkTitle: artwork.title,
      amount: Math.round(artwork.customerPrice * EXTERNAL_SALE_PENALTY_RATE),
      createdAt: now,
      settledAt: null,
      status: "pending_review",
      decidedAt: null,
      decisionNote: null,
    };
    artistPenaltiesCol.set([penalty, ...artistPenaltiesCol.get()]);

    appendActivity(
      "artwork_submitted",
      `"${artwork.title}" marked sold elsewhere`,
      `Removed from GalleryZone. A ₹${penalty.amount.toLocaleString("en-IN")} fee has gone to GalleryZone for review — nothing is charged unless it is approved.`,
    );

    return mockDelay(updated);
  },

  listPenalties: (): Promise<ExternalSalePenalty[]> =>
    mockDelay(artistPenaltiesCol.get()),

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
  getProfile: async () => {
    const profile = artistProfileCol.get();
    const [me, mou] = await Promise.all([
      authService.me(),
      http.get<{ acceptance: MouAcceptanceDto | null }>("/v1/artist/mou"),
    ]);
    const acceptance = mou.acceptance;
    return {
      ...profile,
      fullName: me?.name ?? profile.fullName,
      email: me?.email ?? profile.email,
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
      ...artistProfileCol.get(),
      mouAcceptance: {
        acceptedAt: acceptance.acceptedAt,
        signatureName: acceptance.signatureName,
        version: acceptance.version,
        signatureDataUrl: acceptance.signatureDataUrl,
      },
    };
  },

  // Standard GSTIN shape: 2-digit state code, 10-char PAN, entity number, a
  // literal "Z", then a checksum character. Matches the pattern the profile
  // form itself validates against.
  updateProfile: (patch: Partial<ReturnType<typeof artistProfileCol.get>>) => {
    const current = artistProfileCol.get();
    let gstStatus = current.gstStatus;
    // Saving a valid GSTIN for the first time starts the approval clock —
    // only an admin (GST queue) can move it past "submitted" from here.
    if (
      patch.gstin !== undefined &&
      gstStatus === "not_submitted" &&
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
        patch.gstin.trim(),
      )
    ) {
      gstStatus = "submitted";
    }
    const updated = { ...current, ...patch, gstStatus };
    artistProfileCol.set(updated);
    return mockDelay(updated);
  },

  listOrders: (): Promise<Array<Order & { artistPayout: number }>> => {
    const artistArtworkIds = new Set(artistArtworks().map((a) => a.id));
    const prices = artistPricesCol.get();
    return mockDelay(
      ordersCol
        .get()
        .filter((order) => artistArtworkIds.has(order.artworkId))
        .map((order) => ({
          ...order,
          artistPayout: Math.round((prices[order.artworkId] ?? 0) * 0.98),
        })),
    );
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

  getDeactivationRequest: (): Promise<DeactivationRequest | null> =>
    mockDelay(
      deactivationRequestsCol
        .get()
        .filter((r) => r.userId === CURRENT_ARTIST_ID)
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0] ?? null,
    ),

  requestDeactivation: (input: {
    reason: string;
  }): Promise<DeactivationRequest> => {
    if (!input.reason.trim())
      return mockError("Tell us why you are closing the account");

    const open = deactivationRequestsCol
      .get()
      .some((r) => r.userId === CURRENT_ARTIST_ID && r.status === "pending");
    if (open) return mockError("You already have a request under review");

    const request: DeactivationRequest = {
      id: `deact-${crypto.randomUUID().slice(0, 8)}`,
      userId: CURRENT_ARTIST_ID,
      userName: CURRENT_ARTIST_NAME,
      userRole: "artist",
      reason: input.reason.trim(),
      status: "pending",
      requestedAt: new Date().toISOString(),
      decidedAt: null,
      decisionNote: null,
    };
    deactivationRequestsCol.set([request, ...deactivationRequestsCol.get()]);
    appendActivity(
      "verification",
      "Deactivation requested",
      "Your account closure is waiting on a GalleryZone review.",
    );
    return mockDelay(request);
  },

  withdrawDeactivation: (requestId: string): Promise<{ id: string }> => {
    const request = deactivationRequestsCol
      .get()
      .find((r) => r.id === requestId);
    if (!request) return mockError("Request not found");
    if (request.status !== "pending")
      return mockError("That request has already been decided");

    deactivationRequestsCol.set(
      deactivationRequestsCol.get().filter((r) => r.id !== requestId),
    );
    appendActivity(
      "verification",
      "Deactivation withdrawn",
      "You cancelled your account closure request.",
    );
    return mockDelay({ id: requestId });
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
