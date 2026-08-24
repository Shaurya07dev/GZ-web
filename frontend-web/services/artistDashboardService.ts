import {
  ARTWORK_EDIT_WINDOW_DAYS,
  EXTERNAL_SALE_PENALTY_RATE,
  isPenaltyCollectable,
  WITHDRAWABLE_STATUSES,
  type ArtworkRarity,
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
  dimensions: string;
  yearCreated: number;
  artistPrice: number;
  listingType: Artwork["listingType"];
  insuranceOpted: boolean;
  physical: ArtworkPhysical;
  nfcTagId: string | null;
  rarityType: ArtworkRarity | null;
  images: ArtworkImage[];
  mode: "draft" | "review";
}

export const artistDashboardService = {
  getKpiMetrics: (): Promise<ArtworkKpiMetric[]> => {
    const wallet = artistWalletCol.get();
    const pendingCount = artistArtworks().filter(
      (a) => a.status === "pending_approval",
    ).length;
    return mockDelay([
      KPI_METRICS[0],
      {
        ...KPI_METRICS[1],
        value: `₹${wallet.balance.toLocaleString("en-IN")}`,
        delta:
          wallet.pendingBalance > 0
            ? `₹${wallet.pendingBalance.toLocaleString("en-IN")} pending settlement`
            : "No pending settlements",
      },
      {
        ...KPI_METRICS[2],
        value: String(pendingCount),
        delta: pendingCount > 0 ? "Awaiting admin review" : "All caught up",
      },
    ]);
  },

  getActivity: (): Promise<ActivityEntry[]> =>
    mockDelay(artistActivityCol.get()),

  listArtworks: (): Promise<Array<Artwork & { artistPrice: number }>> => {
    const prices = artistPricesCol.get();
    return mockDelay(
      artistArtworks().map((artwork) => ({
        ...artwork,
        artistPrice: prices[artwork.id] ?? 0,
      })),
    );
  },

  submitArtwork: (input: SubmitArtworkInput): Promise<Artwork> => {
    if (!input.title.trim()) return mockError("A title is required");
    if (input.artistPrice <= 0)
      return mockError("Enter your price for this artwork");

    const now = new Date().toISOString();
    const status = input.mode === "draft" ? "draft" : "pending_approval";
    const id = `aw-${crypto.randomUUID().slice(0, 8)}`;

    const artwork: Artwork = {
      id,
      title: input.title.trim(),
      artistId: CURRENT_ARTIST_ID,
      artistName: CURRENT_ARTIST_NAME,
      verifiedArtist: true,
      category: input.category,
      medium: input.medium,
      customerPrice: displayPriceOf(input.artistPrice),
      thumbnailUrl: input.images[0]?.url ?? "",
      insured: input.insuranceOpted,
      status,
      listingType: input.listingType,
      description: input.description,
      dimensions: input.dimensions || null,
      yearCreated: input.yearCreated || null,
      images: input.images,
      coaCertificateNumber: `GZ-COA-${new Date().getFullYear()}-${id.toUpperCase()}`,
      coaIssueDate: now,
      socialProofLinks: [],
      statusHistory: [{ status, changedAt: now }],
      nfcTagId: input.nfcTagId,
      physical: input.physical,
      rarityType: input.rarityType,
    };

    artistPricesCol.set({ ...artistPricesCol.get(), [id]: input.artistPrice });
    pendingArtworksCol.set([artwork, ...pendingArtworksCol.get()]);
    if (input.mode === "review") settlePendingPenalties(artwork.title);

    appendActivity(
      input.mode === "draft" ? "artwork_submitted" : "artwork_submitted",
      input.mode === "draft"
        ? `"${artwork.title}" saved as draft`
        : `"${artwork.title}" submitted`,
      input.mode === "draft" ? "Not yet sent for review" : "Awaiting admin review",
    );

    return mockDelay(artwork);
  },

  // Edits are refused here, not just hidden in the UI: 7 days from listing, or
  // until the piece is bought or claimed, whichever comes first.
  updateArtwork: (input: {
    artworkId: string;
    patch: Omit<SubmitArtworkInput, "mode">;
  }): Promise<Artwork> => {
    const inLive = artworksCol.get().find((a) => a.id === input.artworkId);
    const inPending = pendingArtworksCol
      .get()
      .find((a) => a.id === input.artworkId);
    const artwork = inLive ?? inPending;

    if (!artwork || artwork.artistId !== CURRENT_ARTIST_ID)
      return mockError("Artwork not found");

    const editState = artworkEditState(artwork);
    if (!editState.editable) {
      return mockError(
        editState.reason === "purchased"
          ? "This artwork has been claimed or sold — it can no longer be edited"
          : `The ${ARTWORK_EDIT_WINDOW_DAYS}-day edit window for this artwork has closed`,
      );
    }

    const { patch } = input;
    if (!patch.title.trim()) return mockError("A title is required");
    if (patch.artistPrice <= 0)
      return mockError("Enter your price for this artwork");

    const updated: Artwork = {
      ...artwork,
      title: patch.title.trim(),
      description: patch.description,
      category: patch.category,
      medium: patch.medium,
      dimensions: patch.dimensions || null,
      yearCreated: patch.yearCreated || null,
      artistName: artwork.artistName,
      customerPrice: displayPriceOf(patch.artistPrice),
      listingType: patch.listingType,
      insured: patch.insuranceOpted,
      physical: patch.physical,
      rarityType: patch.rarityType,
      nfcTagId: patch.nfcTagId,
      images: patch.images.length > 0 ? patch.images : artwork.images,
      thumbnailUrl: patch.images[0]?.url ?? artwork.thumbnailUrl,
    };

    const replace = (list: Artwork[]) =>
      list.map((a) => (a.id === updated.id ? updated : a));
    if (inLive) artworksCol.set(replace(artworksCol.get()));
    if (inPending) pendingArtworksCol.set(replace(pendingArtworksCol.get()));

    artistPricesCol.set({
      ...artistPricesCol.get(),
      [updated.id]: patch.artistPrice,
    });

    appendActivity(
      "artwork_submitted",
      `"${updated.title}" updated`,
      editState.reason === "draft"
        ? "Draft changes saved"
        : `${editState.daysLeft} ${editState.daysLeft === 1 ? "day" : "days"} left in the edit window`,
    );

    return mockDelay(updated);
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

  // Demo shortcut: approve one's own submission without waiting for an admin.
  // Real approval is adminService.approveArtwork and stays the only path in
  // production — this exists so the preview can be walked end to end in one
  // sitting instead of across three days.
  selfApproveArtwork: (artworkId: string): Promise<Artwork> => {
    const pending = pendingArtworksCol.get();
    const artwork = pending.find((a) => a.id === artworkId);
    if (!artwork || artwork.artistId !== CURRENT_ARTIST_ID)
      return mockError("Artwork not found");
    if (artwork.status !== "pending_approval")
      return mockError("Only a submitted artwork can be approved");

    const now = new Date().toISOString();
    const approved: Artwork = {
      ...artwork,
      status: "marketplace",
      statusHistory: [
        ...artwork.statusHistory,
        { status: "marketplace", changedAt: now },
      ],
    };
    pendingArtworksCol.set(pending.filter((a) => a.id !== artworkId));
    artworksCol.set([...artworksCol.get(), approved]);

    appendActivity(
      "artwork_approved",
      `"${approved.title}" approved`,
      "Approved instantly for the demo — normally a curator reviews this",
    );

    return mockDelay(approved);
  },

  listPenalties: (): Promise<ExternalSalePenalty[]> =>
    mockDelay(artistPenaltiesCol.get()),

  // Settlements are released lazily rather than on a timer: reading the wallet
  // is the only moment the 7-days-after-delivery rule is observable, and this
  // mock has no scheduler to run it any other way.
  getWallet: (): Promise<{
    balance: number;
    pendingBalance: number;
    lockedBalance: number;
  }> => {
    releaseDueArtistSettlements();
    return mockDelay(artistWalletCol.get());
  },

  listWalletTransactions: (): Promise<WalletTransaction[]> => {
    releaseDueArtistSettlements();
    return mockDelay(artistWalletTransactionsCol.get());
  },

  /** Sales waiting on the 7-day post-delivery clock. */
  listPendingSettlements: (): Promise<Settlement[]> =>
    mockDelay(pendingArtistSettlements()),

  /** Demo shortcut — nothing in this app marks a customer order delivered. */
  simulateDelivery: (settlementId: string): Promise<void> => {
    simulateDeliveryAndRelease(settlementId);
    return mockDelay(undefined);
  },

  requestWithdrawal: (amount: number): Promise<WalletTransaction> => {
    const wallet = artistWalletCol.get();
    if (amount < 1000) return mockError("Minimum withdrawal is ₹1,000");
    if (amount > wallet.balance)
      return mockError("Exceeds your available balance");

    artistWalletCol.set({ ...wallet, balance: wallet.balance - amount });

    const transaction: WalletTransaction = {
      id: `wt-${crypto.randomUUID().slice(0, 8)}`,
      type: "withdrawal",
      label: `Withdrawal to bank ${artistProfileCol.get().bankAccountMasked.slice(-4)}`,
      amount: -amount,
      date: new Date().toISOString().slice(0, 10),
      status: "completed",
    };
    artistWalletTransactionsCol.set([
      transaction,
      ...artistWalletTransactionsCol.get(),
    ]);
    appendActivity(
      "withdrawal",
      "Withdrawal requested",
      `₹${amount.toLocaleString("en-IN")} sent to your bank account`,
    );

    return mockDelay(transaction);
  },

  getProfile: () => mockDelay(artistProfileCol.get()),

  // Signing the MOU is its own method rather than a profile patch: it records
  // when and against which version, and must never be silently overwritten by
  // an ordinary profile save.
  acceptMou: (input: { signatureName: string; version: string }) => {
    const profile = artistProfileCol.get();
    if (!input.signatureName.trim())
      return mockError("Type your full name to sign");
    if (
      input.signatureName.trim().toLowerCase() !==
      profile.fullName.trim().toLowerCase()
    )
      return mockError("The signature must match the name on your profile");

    const updated = {
      ...profile,
      mouAcceptance: {
        acceptedAt: new Date().toISOString(),
        signatureName: input.signatureName.trim(),
        version: input.version,
      },
    };
    artistProfileCol.set(updated);
    appendActivity(
      "verification",
      "MOU signed",
      `Memorandum of Understanding v${input.version} accepted`,
    );
    return mockDelay(updated);
  },

  updateProfile: (
    patch: Partial<ReturnType<typeof artistProfileCol.get>>,
  ) => {
    const updated = { ...artistProfileCol.get(), ...patch };
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
