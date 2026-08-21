import {
  ARTWORK_EDIT_WINDOW_DAYS,
  EXTERNAL_SALE_PENALTY_RATE,
  WITHDRAWABLE_STATUSES,
  artworkEditState,
  type Artwork,
  type ArtworkImage,
  type ArtworkPhysical,
  type ExternalSalePenalty,
} from "@/types/artwork";
import type { AggregatorHolding } from "@/types/aggregator";
import type { Order } from "@/types/order";
import type { Settlement } from "@/types/admin";
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
  ordersCol,
  holdingsCol,
  CURRENT_ARTIST_ID,
  CURRENT_ARTIST_NAME,
  KPI_METRICS,
} from "@/lib/mock-collections";
import { CUSTOMER_MARKUP_MULTIPLIER } from "@/features/dashboard/artwork-submit-data";
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

// Any penalty an artist owes for selling a piece elsewhere is collected the
// next time they actually list something — drafts don't trigger it. Charged
// as a wallet adjustment; the balance floors at 0 because there's no
// negative-balance/recovery flow in the mock.
function settlePendingPenalties(listingTitle: string) {
  const outstanding = artistPenaltiesCol
    .get()
    .filter((penalty) => penalty.settledAt === null);
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
      customerPrice: Math.round(input.artistPrice * CUSTOMER_MARKUP_MULTIPLIER),
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
      customerPrice: Math.round(patch.artistPrice * CUSTOMER_MARKUP_MULTIPLIER),
      listingType: patch.listingType,
      insured: patch.insuranceOpted,
      physical: patch.physical,
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
  // once, and a penalty of EXTERNAL_SALE_PENALTY_RATE of its listed price is
  // queued against the artist's NEXT listing (settlePendingPenalties above).
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
    };
    artistPenaltiesCol.set([penalty, ...artistPenaltiesCol.get()]);

    appendActivity(
      "artwork_submitted",
      `"${artwork.title}" marked sold elsewhere`,
      `Removed from GalleryZone. ₹${penalty.amount.toLocaleString("en-IN")} will be charged on your next listing.`,
    );

    return mockDelay(updated);
  },

  listPenalties: (): Promise<ExternalSalePenalty[]> =>
    mockDelay(artistPenaltiesCol.get()),

  getWallet: (): Promise<{
    balance: number;
    pendingBalance: number;
    lockedBalance: number;
  }> => mockDelay(artistWalletCol.get()),

  listWalletTransactions: (): Promise<WalletTransaction[]> =>
    mockDelay(artistWalletTransactionsCol.get()),

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

  getSettings: () => mockDelay(artistSettingsCol.get()),

  updateSettings: (
    patch: Partial<ReturnType<typeof artistSettingsCol.get>>,
  ) => {
    const updated = { ...artistSettingsCol.get(), ...patch };
    artistSettingsCol.set(updated);
    return mockDelay(updated);
  },

  updateBankDetails: (input: {
    bankAccountNumber: string;
    ifsc: string;
  }): Promise<{ bankAccountMasked: string; ifsc: string }> => {
    if (!input.bankAccountNumber.trim())
      return mockError("Enter an account number");
    const last4 = input.bankAccountNumber.slice(-4);
    const patch = {
      bankAccountMasked: `•••• •••• •••• ${last4}`,
      ifsc: input.ifsc,
    };
    artistProfileCol.set({ ...artistProfileCol.get(), ...patch });
    return mockDelay(patch);
  },
};
