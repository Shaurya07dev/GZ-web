import type { Artwork, ArtworkImage } from "@/types/artwork";
import { mockDelay, mockError } from "@/lib/mock-utils";
import {
  artworksCol,
  pendingArtworksCol,
  artistWalletCol,
  artistWalletTransactionsCol,
  artistActivityCol,
  artistProfileCol,
  artistPricesCol,
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
  coaDetails: string;
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
    };

    artistPricesCol.set({ ...artistPricesCol.get(), [id]: input.artistPrice });
    pendingArtworksCol.set([artwork, ...pendingArtworksCol.get()]);

    appendActivity(
      input.mode === "draft" ? "artwork_submitted" : "artwork_submitted",
      input.mode === "draft"
        ? `"${artwork.title}" saved as draft`
        : `"${artwork.title}" submitted`,
      input.mode === "draft" ? "Not yet sent for review" : "Awaiting admin review",
    );

    return mockDelay(artwork);
  },

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

  updateProfile: (
    patch: Partial<ReturnType<typeof artistProfileCol.get>>,
  ) => {
    const updated = { ...artistProfileCol.get(), ...patch };
    artistProfileCol.set(updated);
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
