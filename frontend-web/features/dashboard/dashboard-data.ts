import {
  IndianRupee,
  Wallet,
  Clock3,
  Banknote,
  Upload,
  ShieldCheck,
  CircleCheckBig,
} from "lucide-react";

export const ARTIST = {
  name: "Devika Rao",
  avatar: "/early-program/avatar-3.png",
  verifiedTier: 2,
};

export const KPI_METRICS = [
  {
    key: "revenue",
    label: "Total revenue",
    value: "₹1,84,320",
    delta: "+12.4% vs. last month",
    positive: true,
    icon: IndianRupee,
  },
  {
    key: "wallet",
    label: "Wallet balance",
    value: "₹42,180",
    delta: "₹6,400 pending settlement",
    positive: true,
    icon: Wallet,
  },
  {
    key: "pendingApproval",
    label: "Pending approval",
    value: "2",
    delta: "1 submitted yesterday",
    positive: false,
    icon: Clock3,
  },
] as const;

export const REVENUE_SERIES = [
  { month: "Mar", amount: 62000 },
  { month: "Apr", amount: 78500 },
  { month: "May", amount: 71200 },
  { month: "Jun", amount: 96800 },
  { month: "Jul", amount: 118400 },
  { month: "Aug", amount: 184320 },
];

export const ACTIVITY_FEED = [
  {
    id: "act-1",
    icon: CircleCheckBig,
    title: "“Monsoon Reverie” was approved",
    detail: "Live on the marketplace at ₹28,000",
    time: "2 hours ago",
  },
  {
    id: "act-2",
    icon: Banknote,
    title: "Settlement received",
    detail: "₹25,200 credited after commission",
    time: "Yesterday",
  },
  {
    id: "act-3",
    icon: Upload,
    title: "“Terracotta Study No. 4” submitted",
    detail: "Awaiting admin review",
    time: "2 days ago",
  },
  {
    id: "act-4",
    icon: ShieldCheck,
    title: "Tier 2 verification complete",
    detail: "Active plan confirmed",
    time: "5 days ago",
  },
] as const;

export const VERIFICATION_TIERS = [
  {
    tier: 1,
    title: "Social media",
    description: "Linked an official handle to authenticate your identity.",
    detail:
      "Link at least one official social media handle (Instagram, YouTube, or a personal site) so collectors can verify you're a real, active artist.",
    status: "complete" as const,
    completedOn: "2026-02-14",
  },
  {
    tier: 2,
    title: "Active plan",
    description: "Maintained an active plan for 3 months.",
    detail:
      "Keep an active GalleryZone plan for 3 consecutive months. This is free with the physical/aggregator listing model.",
    status: "complete" as const,
    completedOn: "2026-05-20",
  },
  {
    tier: 3,
    title: "First sale",
    description: "Complete your first confirmed sale on GalleryZone.",
    detail:
      "Sell one artwork through the marketplace or an aggregator. Once confirmed, you'll unlock the Gold ✦ Verified badge shown on your public profile and listings.",
    status: "active" as const,
    completedOn: null,
  },
];

export type ArtworkStatus =
  | "draft"
  | "pending_approval"
  | "live"
  | "reserved"
  | "sold";

export type Artwork = {
  id: string;
  title: string;
  image: string;
  medium: string;
  category: string;
  year: number;
  artistPrice: number;
  status: ArtworkStatus;
  submittedAt: string;
};

export const ARTWORKS: Artwork[] = [
  {
    id: "aw-1",
    title: "Monsoon Reverie",
    image: "/ecosystem/artwork-1.png",
    medium: "Oil on Canvas",
    category: "Landscape",
    year: 2025,
    artistPrice: 28000,
    status: "live",
    submittedAt: "2026-07-12",
  },
  {
    id: "aw-2",
    title: "Terracotta Study No. 4",
    image: "/ecosystem/artwork-2.png",
    medium: "Ceramic & Mixed Media",
    category: "Sculpture",
    year: 2026,
    artistPrice: 15000,
    status: "pending_approval",
    submittedAt: "2026-08-08",
  },
  {
    id: "aw-3",
    title: "Silent Horizon",
    image: "/ecosystem/artwork-3.png",
    medium: "Acrylic on Canvas",
    category: "Abstract",
    year: 2025,
    artistPrice: 22000,
    status: "draft",
    submittedAt: "2026-08-10",
  },
  {
    id: "aw-4",
    title: "Eclipse of Thoughts",
    image: "/journey/artwork-preview.png",
    medium: "Acrylic on Canvas",
    category: "Abstract",
    year: 2024,
    artistPrice: 18000,
    status: "reserved",
    submittedAt: "2026-06-02",
  },
  {
    id: "aw-5",
    title: "Whispers in Bronze",
    image: "/artworks/framed-painting.png",
    medium: "Mixed Media",
    category: "Portraiture",
    year: 2023,
    artistPrice: 32000,
    status: "sold",
    submittedAt: "2026-04-18",
  },
  {
    id: "aw-6",
    title: "Fragments of Dawn",
    image: "/artworks/landscape.png",
    medium: "Oil on Canvas",
    category: "Landscape",
    year: 2025,
    artistPrice: 19500,
    status: "live",
    submittedAt: "2026-07-29",
  },
  {
    id: "aw-7",
    title: "Portrait in Amber",
    image: "/artworks/portrait-woman.png",
    medium: "Oil on Canvas",
    category: "Portraiture",
    year: 2026,
    artistPrice: 24000,
    status: "draft",
    submittedAt: "2026-08-09",
  },
];

export type WalletTransaction = {
  id: string;
  type: "settlement" | "withdrawal" | "commission" | "refund" | "adjustment";
  label: string;
  amount: number;
  date: string;
  status: "completed" | "pending" | "failed";
};

export const WALLET_SUMMARY = {
  balance: 42180,
  pendingBalance: 6400,
  lockedBalance: 0,
};

export const WALLET_TRANSACTIONS: WalletTransaction[] = [
  {
    id: "wt-1",
    type: "settlement",
    label: "Settlement — “Monsoon Reverie”",
    amount: 25200,
    date: "2026-08-09",
    status: "completed",
  },
  {
    id: "wt-2",
    type: "withdrawal",
    label: "Withdrawal to bank •••6142",
    amount: -20000,
    date: "2026-08-05",
    status: "completed",
  },
  {
    id: "wt-3",
    type: "settlement",
    label: "Settlement — “Fragments of Dawn”",
    amount: 17550,
    date: "2026-07-30",
    status: "completed",
  },
  {
    id: "wt-4",
    type: "settlement",
    label: "Settlement — “Whispers in Bronze”",
    amount: 6400,
    date: "2026-08-10",
    status: "pending",
  },
  {
    id: "wt-5",
    type: "withdrawal",
    label: "Withdrawal to bank •••6142",
    amount: -15000,
    date: "2026-06-22",
    status: "completed",
  },
];

export const PROFILE = {
  fullName: "Devika Rao",
  email: "devika.rao@example.com",
  phone: "+91 98765 43210",
  bio: "Contemporary landscape and abstract painter based in Udaipur, working primarily in oil and acrylic. Exploring the intersection of monsoon light and memory.",
  instagram: "devikarao.art",
  website: "devikarao.com",
  bankAccountMasked: "•••• •••• •••• 6142",
  ifsc: "HDFC0001234",
  aadhaarStatus: "verified" as const,
  aadhaarMasked: "•••• •••• 4821",
};
