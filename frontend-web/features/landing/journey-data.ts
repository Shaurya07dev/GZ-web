import {
  UploadCloud,
  FileText,
  ShieldCheck,
  FileCheck2,
  CircleCheck,
  QrCode,
  Nfc,
  Sparkles,
  Eye,
  Heart,
  MessageSquare,
  CreditCard,
  Truck,
  Handshake,
  ShieldQuestion,
  Monitor,
  BadgeCheck,
  Radar,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";

export type JourneyIconItem = { icon: LucideIcon; label: string };
export type JourneyDetailRow = { label: string; value: string };
export type JourneyNextStep = { icon: LucideIcon; label: string; sub: string };

export type JourneyStep = {
  number: string;
  label: string;
  description: string;
  badge: string;
  detailDescription: string;
  requirements: JourneyIconItem[];
  ctaLabel: string;
  ctaHref: string;
  previewLabel: string;
  previewBadge: { icon: LucideIcon; label: string };
  detailsLabel: string;
  detailsRows: JourneyDetailRow[];
  statusLabel: string;
  nextSteps: JourneyNextStep[];
};

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    number: "01",
    label: "Submit",
    description: "Artist submits their artwork and details.",
    badge: "STEP 01 OF 05",
    detailDescription:
      "Artist provides artwork details, photos and authenticity information.",
    requirements: [
      { icon: UploadCloud, label: "Upload high-quality images" },
      { icon: FileText, label: "Add artwork details and specifications" },
      { icon: ShieldCheck, label: "Attach COA and supporting documents" },
    ],
    ctaLabel: "Submit Artwork",
    ctaHref: "/register?role=artist",
    previewLabel: "Artwork Preview",
    previewBadge: { icon: UploadCloud, label: "Submitted" },
    detailsLabel: "Artwork Details",
    detailsRows: [
      { label: "Title", value: "Eclipse of Thoughts" },
      { label: "Artist", value: "Aarav Mehta" },
      { label: "Year", value: "2024" },
      { label: "Medium", value: "Acrylic on Canvas" },
      { label: "Dimensions", value: "80 x 100 cm" },
      { label: "Category", value: "Abstract" },
    ],
    statusLabel: "Submitted",
    nextSteps: [
      { icon: ShieldQuestion, label: "Verification", sub: "1-3 days" },
      { icon: ShieldCheck, label: "Approval", sub: "You'll be notified" },
      { icon: Monitor, label: "Listing", sub: "Goes live on GalleryZone" },
    ],
  },
  {
    number: "02",
    label: "Verify",
    description: "We verify authenticity and eligibility.",
    badge: "STEP 02 OF 05",
    detailDescription:
      "Our team checks authenticity, eligibility and documentation before anything goes live.",
    requirements: [
      { icon: FileCheck2, label: "100% handmade, no reproductions" },
      { icon: ShieldCheck, label: "Artist owns all rights" },
      { icon: CircleCheck, label: "Details match submitted documents" },
    ],
    ctaLabel: "View Verification Status",
    ctaHref: "/register?role=artist",
    previewLabel: "Verification Scan",
    previewBadge: { icon: Radar, label: "Under Review" },
    detailsLabel: "Verification Checklist",
    detailsRows: [
      { label: "Handmade confirmed", value: "Passed" },
      { label: "Reproduction check", value: "Passed" },
      { label: "Rights ownership", value: "Confirmed" },
      { label: "Documentation", value: "Complete" },
    ],
    statusLabel: "Under Review",
    nextSteps: [
      { icon: ShieldCheck, label: "Approval", sub: "Curator sign-off" },
      { icon: QrCode, label: "Digital ID", sub: "QR + NFC issued" },
      { icon: Monitor, label: "Listing", sub: "Goes live on GalleryZone" },
    ],
  },
  {
    number: "03",
    label: "List",
    description: "Artwork gets its digital identity and goes live.",
    badge: "STEP 03 OF 05",
    detailDescription:
      "A verified digital identity is issued and the artwork goes live on the marketplace.",
    requirements: [
      { icon: QrCode, label: "Digital ID generated" },
      { icon: Nfc, label: "NFC tag assigned" },
      { icon: Sparkles, label: "Listed on marketplace" },
    ],
    ctaLabel: "View Listing",
    ctaHref: "/marketplace",
    previewLabel: "Digital Identity",
    previewBadge: { icon: BadgeCheck, label: "Live" },
    detailsLabel: "Listing Details",
    detailsRows: [
      { label: "Digital ID", value: "GZ-8F3A-7021" },
      { label: "Customer Price", value: "₹23,400" },
      { label: "Listing Type", value: "Marketplace" },
      { label: "Duration", value: "6 months" },
    ],
    statusLabel: "Live",
    nextSteps: [
      { icon: Eye, label: "Discovery", sub: "Collectors browse" },
      { icon: Handshake, label: "Sale", sub: "Payment confirmed" },
      { icon: CreditCard, label: "Settlement", sub: "Paid within 7 days" },
    ],
  },
  {
    number: "04",
    label: "Discover",
    description: "Collectors discover original art across our ecosystem.",
    badge: "STEP 04 OF 05",
    detailDescription:
      "Collectors browse, wishlist and inquire — your artwork's reach grows across our ecosystem.",
    requirements: [
      { icon: Eye, label: "Marketplace impressions" },
      { icon: Heart, label: "Wishlist saves" },
      { icon: MessageSquare, label: "Collector inquiries" },
    ],
    ctaLabel: "View Insights",
    ctaHref: "/marketplace",
    previewLabel: "Marketplace Card",
    previewBadge: { icon: Eye, label: "340 views" },
    detailsLabel: "Discovery Stats",
    detailsRows: [
      { label: "Profile Views", value: "340" },
      { label: "Wishlist Adds", value: "12" },
      { label: "Inquiries", value: "3" },
      { label: "Days Listed", value: "14" },
    ],
    statusLabel: "Marketplace",
    nextSteps: [
      { icon: Handshake, label: "Offer", sub: "Buyer confirms" },
      { icon: CreditCard, label: "Payment", sub: "Secure checkout" },
      { icon: Truck, label: "Delivery", sub: "Packed & shipped" },
    ],
  },
  {
    number: "05",
    label: "Collect",
    description: "Secure payment, delivery and ownership transfer.",
    badge: "STEP 05 OF 05",
    detailDescription:
      "Secure payment, insured delivery, and a digital ownership transfer that updates the artwork's history for good.",
    requirements: [
      { icon: CreditCard, label: "Secure payment captured" },
      { icon: Truck, label: "Insured, tracked delivery" },
      { icon: Handshake, label: "Ownership transferred" },
    ],
    ctaLabel: "View Settlement",
    ctaHref: "/marketplace",
    previewLabel: "Order Summary",
    previewBadge: { icon: PackageCheck, label: "Sold" },
    detailsLabel: "Settlement Summary",
    detailsRows: [
      { label: "Buyer", value: "Alex Morgan" },
      { label: "Sale Price", value: "₹23,400" },
      { label: "Payment", value: "Confirmed" },
      { label: "Payout", value: "Within 7 days" },
    ],
    statusLabel: "Sold",
    nextSteps: [
      { icon: Truck, label: "Delivery", sub: "Courier tracked" },
      { icon: Handshake, label: "Ownership", sub: "Certificate updated" },
      { icon: BadgeCheck, label: "Complete", sub: "Artist paid in full" },
    ],
  },
];
