// Typed collection instances on top of lib/mock-db.ts's storage primitive.
// One place that knows how every mock service's persisted state is seeded,
// so artworkService/adminService/aggregatorService/customerService/
// orderService/artistDashboardService all read and write the exact same
// underlying records instead of each keeping its own copy.
import type { Artwork, ArtworkStatus } from "@/types/artwork";
import type { AggregatorHolding, AggregatorSale, GallerySpace } from "@/types/aggregator";
import type { Order } from "@/types/order";
import type { Address, CustomerProfile } from "@/types/customer";
import type { AdminUser, Settlement } from "@/types/admin";
import type { MessageThread } from "@/types/message";
import type { SupportTicket } from "@/types/support";
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
import { AGGREGATOR } from "@/features/aggregator/aggregator-data";
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
// mockAggregatorHoldings only references the 7 public mockArtists' work, none
// of Devika Rao's — so her already `with_aggregator` seed artwork (aw-4,
// "Eclipse of Thoughts") needs its own synthetic holding here, or her Gallery
// Spaces page would always be empty despite that status existing.
const DEVIKA_GALLERY_HOLDING: AggregatorHolding = {
  id: "hold-devika-1",
  artworkId: "aw-4",
  advancePercent: 5,
  advanceAmount: Math.round(18000 * 1.3 * 0.05),
  displayPrice: Math.round(18000 * 1.3),
  assignedAt: "2026-07-24T00:00:00.000Z",
  expiresAt: "2026-08-23T00:00:00.000Z",
  status: "reserved",
  assignmentSource: "gz_assigned",
};

export const holdingsCol = collection<AggregatorHolding[]>("holdings", () => [
  ...mockAggregatorHoldings,
  DEVIKA_GALLERY_HOLDING,
]);

export const aggregatorSalesCol = collection<AggregatorSale[]>(
  "aggregatorSales",
  () => [],
);

export const aggregatorGallerySpacesCol = collection<GallerySpace[]>(
  "aggregatorGallerySpaces",
  () => [
    {
      id: "space-1",
      name: "Verandah Art House — Main Gallery",
      addressLine1: "14 Church Street",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      capacity: 12,
      coordinatorName: AGGREGATOR.contactPerson,
    },
  ],
);

export const aggregatorWalletCol = collection("aggregatorWallet", () => ({
  balance: 0,
  pendingBalance: 0,
  lockedBalance: 0,
}));
export const aggregatorWalletTransactionsCol = collection<WalletTransaction[]>(
  "aggregatorWalletTransactions",
  () => [],
);
export const aggregatorSettlementsCol = collection<Settlement[]>(
  "aggregatorSettlements",
  () => [],
);

const AGGREGATOR_MESSAGE_SEED: MessageThread[] = [
  {
    id: "agg-msg-1",
    from: "GalleryZone Audit Team",
    subject: "Scheduled inventory audit — Verandah Art House",
    preview:
      "A GalleryZone auditor will visit on 18 Aug 2026 to reconcile on-premises inventory.",
    body: "Per MOU §8, GalleryZone will conduct a physical inventory audit at your premises on 18 Aug 2026 between 10:00–14:00 IST. Please ensure all GalleryZone-assigned pieces are accessible and match your My Inventory register. Contact your coordinator if any piece is in transit.",
    unread: true,
    receivedAt: "2026-08-10T09:00:00.000Z",
  },
  {
    id: "agg-msg-2",
    from: "GalleryZone Custody Desk",
    subject: '"Density Study, Karol Bagh" custody expires in 2 days',
    preview:
      "The 30-day display window for this reserved piece ends on 13 Aug 2026.",
    body: '"Density Study, Karol Bagh" (holding hold-4) expires on 13 Aug 2026. Record a sale before expiry or request a return shipment from Shipping — unreturned pieces after expiry may incur custody fees per MOU §4.',
    unread: true,
    receivedAt: "2026-08-11T08:30:00.000Z",
  },
  {
    id: "agg-msg-3",
    from: "GalleryZone Insurance Desk",
    subject: "Damage report acknowledged — \"Salvaged Frequencies\"",
    preview:
      "We received your transit-damage report and have opened a claim review.",
    body: "Your damage report for \"Salvaged Frequencies\" (minor corner abrasion noted on receipt) is logged under claim REF-DMG-2026-0810. A GalleryZone adjuster will follow up within 2 business days. Do not attempt repairs until instructed — photos on file are sufficient for now.",
    unread: false,
    receivedAt: "2026-08-08T15:20:00.000Z",
  },
  {
    id: "agg-msg-4",
    from: "GalleryZone Coordinator Program",
    subject: "Welcome — your nominated coordinator is on file",
    preview:
      "Meher Chatterjee is registered as Verandah Art House's GalleryZone coordinator.",
    body: "Welcome to the Aggregator Portal. MOU §10 requires one nominated GalleryZone coordinator per premises — we have Meher Chatterjee on file for Verandah Art House — Main Gallery. They will receive audit notices, expiry reminders, and inbound shipment alerts on your behalf.",
    unread: false,
    receivedAt: "2026-07-15T10:00:00.000Z",
  },
  {
    id: "agg-msg-5",
    from: "GalleryZone Settlements",
    subject: "Settlement pending for \"Salvaged Frequencies\"",
    preview:
      "Sale recorded — aggregator commission will credit after delivery confirmation.",
    body: "You recorded a sale for \"Salvaged Frequencies\" on 5 Jul 2026. Settlement (20% of your markup over the listed price) will credit to your wallet once delivery is confirmed and the 7-day settlement window clears. Track status under Wallet and Settlements.",
    unread: false,
    receivedAt: "2026-07-05T18:45:00.000Z",
  },
];

export const aggregatorMessagesCol = collection<MessageThread[]>(
  "aggregatorMessages",
  () => [...AGGREGATOR_MESSAGE_SEED],
);
export const aggregatorSupportTicketsCol = collection<SupportTicket[]>(
  "aggregatorSupportTickets",
  () => [
    {
      id: "agg-ticket-1",
      subject: "Clarification on security deposit refund terms",
      message:
        "Our MOU security deposit is marked active — if we exit the program, is the ₹50,000 deposit refunded after the final audit and return of all assigned inventory, or is there a waiting period?",
      status: "answered",
      createdAt: "2026-07-22T11:10:00.000Z",
    },
  ],
);
export const aggregatorSettingsCol = collection("aggregatorSettings", () => ({
  notifyNewAssignment: true,
  notifySaleRecorded: true,
  notifySettlementProcessed: true,
  notifyExpiryReminder: true,
}));
export const aggregatorProfileCol = collection("aggregatorProfile", () => ({
  companyName: AGGREGATOR.companyName,
  contactPerson: AGGREGATOR.contactPerson,
  avatar: AGGREGATOR.avatar,
  gstNumber: "29ABCDE1234F1Z5",
  phone: "+91 98450 12345",
  addressLine1: "14 Church Street, Bengaluru, Karnataka 560001",
  bankAccountMasked: "•••• •••• •••• 4821",
  ifsc: "HDFC0001234",
  securityDepositStatus: "active" as const,
}));

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
