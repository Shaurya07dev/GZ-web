import {
  Presentation,
  User,
  Landmark,
  Network,
  Upload,
  Focus,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type EcosystemBullet = {
  icon: LucideIcon;
  text: string;
};

export type EcosystemPersona = {
  key: string;
  navLabel: string;
  navIcon: LucideIcon;
  eyebrow: string;
  headline: string;
  body: string;
  bullets: EcosystemBullet[];
  ctaLabel: string;
  href: string;
  previewImage: string;
  previewAlt: string;
};

export const ECOSYSTEM_PERSONAS: EcosystemPersona[] = [
  {
    key: "artists",
    navLabel: "For Artists",
    navIcon: Presentation,
    eyebrow: "FOR ARTISTS",
    headline: "Create. Showcase. Grow.",
    body: "A dedicated space to present original work, build a digital presence and reach potential buyers.",
    bullets: [
      { icon: Upload, text: "Upload & manage your artworks with ease." },
      {
        icon: Focus,
        text: "Get your artwork verified and assigned a digital identity.",
      },
      {
        icon: TrendingUp,
        text: "Reach the right collectors and grow your presence.",
      },
    ],
    ctaLabel: "Explore as Artist",
    href: "/register?role=artist",
    previewImage: "/ecosystem/artist-persona.jpg",
    previewAlt: "Fine artist creating an expressive artwork on canvas in a sunlit loft studio",
  },
  {
    key: "collectors",
    navLabel: "For Collectors",
    navIcon: User,
    eyebrow: "FOR COLLECTORS",
    headline: "Discover. Collect. Own.",
    body: "A curated marketplace of verified original art, with provenance built in from the very first sale.",
    bullets: [
      {
        icon: Upload,
        text: "Browse verified originals across every medium.",
      },
      {
        icon: Focus,
        text: "Every piece ships with a digital certificate of authenticity.",
      },
      {
        icon: TrendingUp,
        text: "Track your collection's story and value over time.",
      },
    ],
    ctaLabel: "Explore as Collector",
    href: "/register?role=customer",
    previewImage: "/ecosystem/collector-persona.jpg",
    previewAlt: "Art collector discovering fine artwork in a luxury marble gallery lounge",
  },
  {
    key: "galleries",
    navLabel: "For Galleries & Aggregators",
    navIcon: Landmark,
    eyebrow: "FOR GALLERIES & AGGREGATORS",
    headline: "Display. Sell. Earn.",
    body: "Reserve inventory from verified artists, showcase it in your space, and earn commission on every sale.",
    bullets: [
      {
        icon: Upload,
        text: "Reserve artwork with a small advance and a 30-day hold.",
      },
      {
        icon: Focus,
        text: "Set your own display price, never below the marketplace floor.",
      },
      {
        icon: TrendingUp,
        text: "Earn commission automatically on every confirmed sale.",
      },
    ],
    ctaLabel: "Explore as Gallery",
    href: "/register?role=aggregator",
    previewImage: "/ecosystem/gallery-persona.jpg",
    previewAlt: "Prestigious contemporary art gallery displaying curated paintings and sculptures",
  },
  {
    key: "network",
    navLabel: "The Network",
    navIcon: Network,
    eyebrow: "THE NETWORK",
    headline: "One ecosystem. Every collector.",
    body: "Artists, collectors, and galleries share one trusted network: verified identity, transparent history, global reach.",
    bullets: [
      {
        icon: Upload,
        text: "One verified identity that travels across the whole platform.",
      },
      {
        icon: Focus,
        text: "Provenance and ownership history stay attached to the work.",
      },
      {
        icon: TrendingUp,
        text: "Global reach across the marketplace, galleries and exhibitions.",
      },
    ],
    ctaLabel: "Explore the Network",
    href: "/about",
    previewImage: "/ecosystem/network-persona.jpg",
    previewAlt: "Artistic painting of a global art network connecting artists, collectors and galleries through golden threads of light",
  },
];
