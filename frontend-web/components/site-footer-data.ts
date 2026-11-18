import type { ComponentType, SVGProps } from "react";
import { Mail } from "lucide-react";
import { InstagramGlyph, LinkedinGlyph, XGlyph, YoutubeGlyph } from "./social-icons";

export type FooterLink =
  | { label: string; href: string; comingSoon?: false }
  | { label: string; comingSoon: true };

export type FooterColumn = { title: string; links: FooterLink[] };

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "EXPLORE",
    links: [
      { label: "Artworks", href: "/marketplace" },
      { label: "Artists", href: "/artists" },
      { label: "Collections", href: "/marketplace" },
      { label: "Exhibitions", comingSoon: true },
      // Client (19 Oct 2026): the "Magazine" slot becomes the Blogs section —
      // artists write, GalleryZone accepts and publishes the best. For now the
      // link resolves to a lightweight "coming soon" page so a cold visitor
      // sees the surface exists; the real list + admin accept flow lands in a
      // follow-up PR.
      { label: "Blogs", href: "/blogs" },
    ],
  },
  {
    title: "FOR ARTISTS",
    links: [
      { label: "Join GalleryZone", href: "/register?role=artist" },
      { label: "Early Artist Program", href: "/register?role=artist" },
      { label: "Artist Survey", href: "/artist-survey" },
      { label: "Collaborations", href: "/contact?type=collaboration" },
      { label: "How It Works", href: "/about" },
      { label: "Artist Support", href: "/contact?type=support" },
    ],
  },
  {
    title: "FOR COLLECTORS",
    links: [
      { label: "Discover Art", href: "/marketplace" },
      { label: "Collections", href: "/marketplace" },
      { label: "How It Works", href: "/about" },
      { label: "Commission Art", comingSoon: true },
      { label: "FAQs", href: "/faq" },
      { label: "Collector Support", href: "/contact?type=support" },
    ],
  },
  {
    title: "CATEGORIES",
    links: [
      { label: "Paintings", href: "/marketplace" },
      { label: "Other Art Works", comingSoon: true },
      { label: "Art Supplies", href: "/art-supplies" },
    ],
  },
  {
    title: "COMPANY",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Our Mission", href: "/our-mission" },
      { label: "Careers", comingSoon: true },
      { label: "Newsroom", comingSoon: true },
      { label: "Contact", href: "/contact?type=general" },
    ],
  },
  {
    title: "LEGAL",
    links: [
      { label: "Terms & Conditions", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Delete Account", href: "/account-deletion" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
  },
];

export type SocialLink = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  href: string;
  label: string;
  target?: string;
  rel?: string;
};

export const SOCIAL_LINKS: SocialLink[] = [
  {
    icon: InstagramGlyph,
    href: "https://www.instagram.com/galleryzone.in",
    label: "Instagram",
    target: "_blank",
    rel: "noopener noreferrer",
  },
  {
    icon: XGlyph,
    href: "https://x.com/Galleryzone_in",
    label: "X",
    target: "_blank",
    rel: "noopener noreferrer",
  },
  {
    icon: YoutubeGlyph,
    href: "https://youtube.com/@officialgalleryzone",
    label: "YouTube",
    target: "_blank",
    rel: "noopener noreferrer",
  },
  {
    icon: LinkedinGlyph,
    href: "https://www.linkedin.com/company/galleryzone/",
    label: "LinkedIn",
    target: "_blank",
    rel: "noopener noreferrer",
  },
  {
    icon: Mail,
    href: "https://mail.google.com/mail/?view=cm&fs=1&to=galleryzone@zohomail.in",
    label: "Email",
    target: "_blank",
    rel: "noopener noreferrer",
  },
];
