import type { ComponentType, SVGProps } from "react";
import { Mail } from "lucide-react";
import { InstagramGlyph, XGlyph, LinkedinGlyph } from "./social-icons";

export type FooterLink = { label: string; href: string };
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
      { label: "How It Works", href: "/about" },
      { label: "Guidelines", href: "/about" },
      { label: "Resources", href: "/about" },
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
    title: "COMPANY",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Our Mission", href: "/about" },
      { label: "Careers", href: "/about" },
      { label: "Newsroom", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
];

export const SOCIAL_LINKS: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  href: string;
  label: string;
}[] = [
  { icon: InstagramGlyph, href: "#", label: "Instagram" },
  { icon: XGlyph, href: "#", label: "X" },
  { icon: LinkedinGlyph, href: "#", label: "LinkedIn" },
  { icon: Mail, href: "mailto:hello@galleryzone.com", label: "Email" },
];
