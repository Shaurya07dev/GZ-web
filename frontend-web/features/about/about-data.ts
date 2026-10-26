import {
  type LucideIcon,
  Lock,
  ShieldCheck,
  Globe,
  Share2,
  FileSignature,
  HandCoins,
  Sparkles,
  QrCode,
  Fingerprint,
  Landmark,
} from "lucide-react";

// All copy on this page is sourced from the Artist Onboarding Guide
// ("Platform Overview", "3-Tier Artist Verification System", and
// "Next-Gen Art Tech Features" sections) and restated for a general
// audience, not the artist-task-list phrasing already used in
// features/dashboard/verification-progress.tsx and verification-detail.tsx.

export interface OverviewPillar {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const OVERVIEW_PILLARS: OverviewPillar[] = [
  {
    title: "100% Price Privacy",
    description:
      "Every artist's listed price stays completely confidential. Buyers and the public only ever see the marketplace price, so market value is protected across every channel.",
    icon: Lock,
  },
  {
    title: "Verified Authenticity",
    description:
      "Every artwork ships with a signed authenticity statement, a Certificate of Authenticity, and an origin declaration, linked digitally to its record and handed to the buyer at purchase.",
    icon: ShieldCheck,
  },
  {
    title: "Physical & Digital Reach",
    description:
      "Curated gallery partners can take possession of and display an artist's work in person, while the GalleryZone marketplace reaches verified buyers worldwide, with logistics handled end to end.",
    icon: Globe,
  },
];

export interface VerificationTier {
  tier: 1 | 2 | 3;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const VERIFICATION_TIERS: VerificationTier[] = [
  {
    tier: 1,
    title: "Social Media",
    description:
      "The artist links at least one official social media handle, connecting their GalleryZone identity to a real, active creative practice anyone can look up.",
    icon: Share2,
  },
  {
    tier: 2,
    title: "Artist Agreement",
    description:
      "The artist reads and signs the current GalleryZone Artist MOU covering listing, sale, settlement, custody, and provenance.",
    icon: FileSignature,
  },
  {
    tier: 3,
    title: "First Sale",
    description:
      "The artist completes one confirmed sale, whether it closes through the open marketplace or a gallery partner.",
    icon: HandCoins,
  },
];

export const GOLD_VERIFIED = {
  title: "Verified",
  description:
    "Clearing all three tiers unlocks the Verified badge, shown on the artist's profile and every listing, GalleryZone's clearest signal that an identity, activity, and track record have all been confirmed.",
  icon: Sparkles,
};

export interface TechFeature {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const TECH_FEATURES: TechFeature[] = [
  {
    title: "NFC & QR Passport",
    description:
      "Accepted artworks can carry a locked NFC tag and QR link to a persistent digital passport, Certificate of Authenticity, and ownership history. The record stays with the work across galleries and collectors.",
    icon: QrCode,
  },
  {
    title: "Digital Identity & Provenance",
    description:
      "Every artwork receives a persistent digital identity connected to its Certificate of Authenticity, origin, and ownership history.",
    icon: Fingerprint,
  },
  {
    title: "Escrow & Bank Payouts",
    description:
      "GalleryZone records payment, delivery, settlement, and payout status in a transparent ledger, then releases eligible earnings to the verified bank account after the settlement window.",
    icon: Landmark,
  },
];
