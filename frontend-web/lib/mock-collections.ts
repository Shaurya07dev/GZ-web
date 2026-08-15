// Typed collection instances on top of lib/mock-db.ts's storage primitive.
// One place that knows how every mock service's persisted state is seeded,
// so artworkService/adminService/aggregatorService/customerService/
// orderService/artistDashboardService all read and write the exact same
// underlying records instead of each keeping its own copy.
import type { Artwork, ArtworkStatus } from "@/types/artwork";
import type { AggregatorHolding } from "@/types/aggregator";
import type { Order } from "@/types/order";
import type { Address, CustomerProfile } from "@/types/customer";
import type { AdminUser } from "@/types/admin";
import { mockArtworks } from "./mock-data/artworks";
import { mockAggregatorHoldings } from "./mock-data/aggregator-holdings";
import { mockOrders, mockAddresses, mockCustomer } from "./mock-data/customer";
import { mockPendingArtworks, mockAdminUsers } from "./mock-data/admin";
import {
  ARTIST,
  KPI_METRICS,
  REVENUE_SERIES,
  ACTIVITY_FEED,
  VERIFICATION_TIERS,
  WALLET_SUMMARY,
  WALLET_TRANSACTIONS,
  PROFILE,
  type WalletTransaction,
} from "@/features/dashboard/dashboard-data";
import { getCollection, setCollection } from "./mock-db";

function collection<T>(key: string, seed: () => T) {
  return {
    get: () => getCollection(key, seed),
    set: (value: T) => setCollection(key, value),
  };
}

// --- Devika Rao's own 7 demo artworks (seed only, migrated off the old
// dashboard-only Artwork/ArtworkStatus shape onto the canonical one so her
// submissions live in the same collections the rest of the app reads) -----
const ARTIST_SEED_ARTWORKS: Array<{
  id: string;
  title: string;
  image: string;
  medium: string;
  category: string;
  year: number;
  artistPrice: number;
  status: ArtworkStatus;
  submittedDaysAgo: number;
}> = [
  {
    id: "aw-1",
    title: "Monsoon Reverie",
    image: "/ecosystem/artwork-1.png",
    medium: "Oil on Canvas",
    category: "landscape",
    year: 2025,
    artistPrice: 28000,
    status: "marketplace",
    submittedDaysAgo: 34,
  },
  {
    id: "aw-2",
    title: "Terracotta Study No. 4",
    image: "/ecosystem/artwork-2.png",
    medium: "Ceramic & Mixed Media",
    category: "sculpture",
    year: 2026,
    artistPrice: 15000,
    status: "pending_approval",
    submittedDaysAgo: 7,
  },
  {
    id: "aw-3",
    title: "Silent Horizon",
    image: "/ecosystem/artwork-3.png",
    medium: "Acrylic on Canvas",
    category: "painting",
    year: 2025,
    artistPrice: 22000,
    status: "draft",
    submittedDaysAgo: 5,
  },
  {
    id: "aw-4",
    title: "Eclipse of Thoughts",
    image: "/journey/artwork-preview.png",
    medium: "Acrylic on Canvas",
    category: "painting",
    year: 2024,
    artistPrice: 18000,
    status: "with_aggregator",
    submittedDaysAgo: 74,
  },
  {
    id: "aw-5",
    title: "Whispers in Bronze",
    image: "/artworks/framed-painting.png",
    medium: "Mixed Media",
    category: "mixed media",
    year: 2023,
    artistPrice: 32000,
    status: "sold",
    submittedDaysAgo: 119,
  },
  {
    id: "aw-6",
    title: "Fragments of Dawn",
    image: "/artworks/landscape.png",
    medium: "Oil on Canvas",
    category: "landscape",
    year: 2025,
    artistPrice: 19500,
    status: "marketplace",
    submittedDaysAgo: 17,
  },
  {
    id: "aw-7",
    title: "Portrait in Amber",
    image: "/artworks/portrait-woman.png",
    medium: "Oil on Canvas",
    category: "portraiture",
    year: 2026,
    artistPrice: 24000,
    status: "draft",
    submittedDaysAgo: 6,
  },
];

function buildArtistSeedArtworks(): Artwork[] {
  return ARTIST_SEED_ARTWORKS.map((seed) => {
    const submittedAt = new Date(
      Date.now() - seed.submittedDaysAgo * 24 * 60 * 60 * 1000,
    ).toISOString();
    return {
      id: seed.id,
      title: seed.title,
      artistId: CURRENT_ARTIST_ID,
      artistName: CURRENT_ARTIST_NAME,
      verifiedArtist: true,
      category: seed.category,
      medium: seed.medium,
      customerPrice: Math.round(seed.artistPrice * 1.3),
      thumbnailUrl: seed.image,
      insured: seed.artistPrice > 20000,
      status: seed.status,
      listingType: "marketplace_and_aggregator",
      description: `${seed.medium}, ${seed.year}. Submitted by ${CURRENT_ARTIST_NAME} through the Artist Dashboard.`,
      dimensions: null,
      yearCreated: seed.year,
      images: [
        { url: seed.image, thumbnailUrl: seed.image, sortOrder: 0, altText: seed.title },
      ],
      coaCertificateNumber: `GZ-COA-2026-${seed.id.toUpperCase()}`,
      coaIssueDate: submittedAt,
      socialProofLinks: [],
      statusHistory: [{ status: seed.status, changedAt: submittedAt }],
      nfcTagId: null,
    };
  });
}

const ARTIST_SEED_PRICES: Record<string, number> = Object.fromEntries(
  ARTIST_SEED_ARTWORKS.map((seed) => [seed.id, seed.artistPrice]),
);

const PENDING_STATUSES = new Set<ArtworkStatus>(["draft", "pending_approval"]);

export const artworksCol = collection<Artwork[]>("artworks", () => [
  ...mockArtworks,
  ...buildArtistSeedArtworks().filter((a) => !PENDING_STATUSES.has(a.status)),
]);
export const pendingArtworksCol = collection<Artwork[]>(
  "pendingArtworks",
  () => [
    ...mockPendingArtworks,
    ...buildArtistSeedArtworks().filter((a) => PENDING_STATUSES.has(a.status)),
  ],
);
export const holdingsCol = collection<AggregatorHolding[]>("holdings", () => [
  ...mockAggregatorHoldings,
]);
export const ordersCol = collection<Order[]>("orders", () => [...mockOrders]);
export const addressesCol = collection<Address[]>("addresses", () => [
  ...mockAddresses,
]);
export const customerProfileCol = collection<CustomerProfile>(
  "customerProfile",
  () => ({ ...mockCustomer }),
);
export const adminUsersCol = collection<AdminUser[]>("adminUsers", () => [
  ...mockAdminUsers,
]);
// Withdrawals/settlements/categories/audit-log/settings/reports are left on
// adminService's existing "resolve a plausible value, don't persist" pattern
// — the audit called those pages already Built and correctly wired (several
// have their own live-append mechanism, e.g. store/useAdminAuditStore for
// the audit log), and they sit outside the artist-submit → admin-approve →
// marketplace → checkout pipeline this persistence layer exists for.

// --- Artist dashboard (single demo artist, "Devika Rao") -------------------
// She's deliberately not one of the 7 public mockArtists (see
// lib/mock-data/admin.ts's comment on "user-artist-devika-rao") — this id is
// the one thing that ties her dashboard artworks, wallet and profile
// together across services.
export const CURRENT_ARTIST_ID = "devika-rao";
export const CURRENT_ARTIST_NAME = ARTIST.name;

export const artistWalletCol = collection("artistWallet", () => ({
  ...WALLET_SUMMARY,
}));
export const artistWalletTransactionsCol = collection<WalletTransaction[]>(
  "artistWalletTransactions",
  () => [...WALLET_TRANSACTIONS],
);
export const artistActivityCol = collection("artistActivity", () => [
  ...ACTIVITY_FEED,
]);
export const artistProfileCol = collection("artistProfile", () => ({
  ...PROFILE,
  socialProofVideoUrl: null as string | null,
}));

// Artist's own asking price per artwork id — deliberately kept OUT of the
// Artwork/ArtworkSummary shape (see types/artwork.ts: "the artist_price
// confidentiality rule is structurally enforced" by that field's absence).
// Only artistDashboardService reads/writes this; admin/marketplace/
// aggregator services never touch it.
export const artistPricesCol = collection<Record<string, number>>(
  "artistPrices",
  () => ({ ...ARTIST_SEED_PRICES }),
);

// Static display-only seeds the dashboard still reads directly (nothing
// mutates these in this phase): KPI revenue delta copy, the 6-month revenue
// chart, and the 3-tier verification ladder.
export { KPI_METRICS, REVENUE_SERIES, VERIFICATION_TIERS, ARTIST };
