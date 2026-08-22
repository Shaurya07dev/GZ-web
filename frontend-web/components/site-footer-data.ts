import type { ComponentType, SVGProps } from "react";
import { Mail } from "lucide-react";
import { InstagramGlyph, XGlyph, LinkedinGlyph } from "./social-icons";

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
      { label: "Exhibitions", href: "/about" },
      { label: "Magazine", href: "/about" },
    ],
  },
  {
    title: "FOR ARTISTS",
    links: [
      { label: "Join GalleryZone", href: "/register?role=artist" },
      { label: "Early Artist Program", href: "/register?role=artist" },
      { label: "Artist Survey", href: "/artist-survey" },
      { label: "Collaborations", href: "/contact" },
      { label: "How It Works", href: "/about" },
      { label: "MOU Agreement", href: "/artist-terms" },
      { label: "Artist Support", href: "/contact" },
    ],
  },
  {
    title: "FOR COLLECTORS",
    links: [
      { label: "Discover Art", href: "/marketplace" },
      { label: "Collections", href: "/marketplace" },
      { label: "How It Works", href: "/about" },
      { label: "FAQs", href: "/faq" },
      { label: "Collector Support", href: "/contact" },
    ],
  },
  {
    title: "CATEGORIES",
    links: [
      { label: "Paintings", href: "/marketplace" },
      { label: "Sculptures", href: "/marketplace" },
      { label: "Digital Art", href: "/marketplace" },
      { label: "Handicrafts", comingSoon: true },
      { label: "Canvas & Brushes", comingSoon: true },
    ],
  },
  {
    title: "COMPANY",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Our Mission", href: "/about" },
      { label: "Careers", href: "/about" },
      { label: "Newsroom", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
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
  { icon: XGlyph, href: "#", label: "X" },
  { icon: LinkedinGlyph, href: "#", label: "LinkedIn" },
  {
    icon: Mail,
    href: "https://mail.google.com/mail/?view=cm&fs=1&to=galleryzone@zohomail.in",
    label: "Email",
    target: "_blank",
    rel: "noopener noreferrer",
  },
];
