// Per-role onboarding tour steps. Targets are CSS selectors — the matching
// elements must carry a `data-tour="xxx"` attribute, added in each role's
// shell. If a target isn't on the current page the tour engine silently
// skips the step rather than crashing (checked below in the shell mount).
//
// Keep step count around 10 — longer and users bail; shorter and the tour
// doesn't earn its welcome.

import type { Step } from "react-joyride";

const BASE_PLACEMENT = { placement: "right" as const };

export const CUSTOMER_TOUR_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    content:
      "Welcome to GalleryZone. This is your Collector Portal. Let's walk through the pieces you'll use most. You can skip this at any time and reopen it from Support later.",
    skipBeacon: true,
  },
  {
    target: '[data-tour="customer-view-site"]',
    content: "Jump back to the public marketplace anytime — same site every visitor sees.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="customer-dashboard"]',
    content: "Your snapshot: recent orders, pieces owned, wishlist count. This is where you land after signing in.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="customer-discover"]',
    content: "Discover goes straight to the marketplace to find new work.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="customer-wishlist"]',
    content: "Hearts you've tapped on an artwork land here. Nothing is committed yet — it's a bookmark list.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="customer-collection"]',
    content: "Pieces delivered to you live here, each with its Certificate of Authenticity and ownership history.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="customer-coa"]',
    content: "A dedicated board for the certificate side: view the public passport, transfer rights to someone else, or request the printed COA.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="customer-orders"]',
    content: "Every purchase, with its status, shipment stage, and invoice.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="customer-resale"]',
    content: "If you ever want to resell a piece you own, start it here. GalleryZone handles the transfer and the certificate update.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="customer-profile"]',
    content: "Keep your name, phone, and shipping addresses current — your orders ship to the default address here.",
    ...BASE_PLACEMENT,
  },
];

export const ARTIST_TOUR_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    content:
      "Welcome. This is your Artist Dashboard. We'll point out the main pieces you'll come back to. Skippable anytime.",
    skipBeacon: true,
  },
  {
    target: '[data-tour="artist-view-site"]',
    content: "Pinned here so you can jump to the public site and see how your work shows up to buyers.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="artist-profile"]',
    content: "Start here. KYC, bank, GST, and the MOU — all required before you can submit your first artwork.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="artist-artworks"]',
    content: "Every piece you've submitted lives here with its moderation status: draft, submitted, approved, listed, sold.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="artist-upload"]',
    content: "Submit a new piece: title, dimensions, medium, photos, your take-home price. GalleryZone's markup is added on top for the buyer.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="artist-coa"]',
    content: "Link an NFC tag to a piece, preview the public passport, and manage certificates — all from this one board.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="artist-portfolio"]',
    content: "Your public artist page. Buyers reach it from any artwork. Keep the bio and headline sharp — it's your signature.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="artist-earnings"]',
    content: "What you're owed, what's clearing, and the bank account GalleryZone pays into. Payouts are released 7 days after delivery.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="artist-blogs"]',
    content: "Write about your work, process, or inspiration. Admin reviews each post; accepted ones publish to the public /blogs page.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="artist-messages"]',
    content: "Platform notifications: approvals, sales, settlements, messages from GalleryZone. Checked daily is enough.",
    ...BASE_PLACEMENT,
  },
];

export const AGGREGATOR_TOUR_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    content:
      "Welcome to the Aggregator Portal. This walkthrough covers the pieces you'll return to most. Skippable anytime.",
    skipBeacon: true,
  },
  {
    target: '[data-tour="aggregator-profile"]',
    content: "Start here: bank, GST, display space addresses, and the Aggregator MOU. All required before you can reserve a piece.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="aggregator-inventory"]',
    content: "Pieces available to reserve. Pay the advance through Razorpay and the piece moves into your inventory for 30 days.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="aggregator-collection"]',
    content: "The pieces currently with you. Record a sale, request an extension, return to GalleryZone, or report an issue — all from here.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="aggregator-orders"]',
    content: "Every sale you've recorded, with its remittance status and settlement.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="aggregator-shipping"]',
    content: "Inbound and outbound shipments — track every piece from the artist's studio to the buyer's door.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="aggregator-spaces"]',
    content: "Each physical display space where you'll show the pieces. GalleryZone verifies each address once.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="aggregator-earnings"]',
    content: "Commission earned on sales, grouped by month. Payouts go to the verified bank account on your profile.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="aggregator-analytics"]',
    content: "How your inventory is converting: which price bands sell, which galleries move most, cycle times.",
    ...BASE_PLACEMENT,
  },
  {
    target: '[data-tour="aggregator-support"]',
    content: "Open a ticket with GalleryZone for anything you can't resolve from the holding page.",
    ...BASE_PLACEMENT,
  },
];
