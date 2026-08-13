import type { LegalSection } from "../types";

// Drafted from the real MOU clauses in `Artist Complete workflow.md`
// ("Responsibilities & Legal" section), generalized from artist-only
// language to all three account roles (artist, aggregator, customer) —
// GalleryZone is a marketplace all three transact on, not just artists.
// Standard marketplace boilerplate ("Accounts", "Payments & Wallet",
// "Limitation of Liability", "Dispute Resolution") is added alongside the
// source-grounded clauses so the document reads as complete, not a partial
// excerpt of the MOU.
export const termsSections: LegalSection[] = [
  {
    id: "accounts",
    heading: "Accounts",
    body: [
      "You must register an account to list, reserve, or purchase artwork on GalleryZone. You agree to provide accurate registration information and to keep it up to date, and you're responsible for all activity that happens under your account.",
      "Artists additionally submit government ID and, where applicable, a signature sample as part of onboarding; this is used to verify identity and to support the Certificate of Authenticity issued for each listed artwork, and is not shared publicly.",
    ],
  },
  {
    id: "ownership-rights",
    heading: "Ownership & Rights",
    body: [
      "The artist or seller retains full ownership of an artwork right up until a sale is confirmed. Listing a work on GalleryZone does not transfer ownership, and does not grant GalleryZone any exclusive rights to it.",
      "While a listing is active, GalleryZone holds a non-exclusive right to promote and market the artwork (on the marketplace itself, in curated collections, and across GalleryZone's own marketing channels) for the duration of that listing only.",
    ],
  },
  {
    id: "eligibility",
    heading: "Eligibility",
    body: [
      "Every artwork submitted for listing must be 100% handmade and original. Replicas, AI-generated pieces, digital prints, and NFTs are not eligible for listing.",
      "The person listing the work must own all rights to it and must be able to confirm, in good faith, that the work does not infringe any third party's intellectual property. GalleryZone's curator review checks quality, authenticity, and eligibility before a listing goes live, and reserves the right to reject or request corrections at any stage of that review.",
    ],
  },
  {
    id: "exclusivity",
    heading: "Exclusivity While Listed",
    body: [
      "An artwork actively listed on GalleryZone may not simultaneously be listed for sale on another marketplace or platform. This applies for as long as the listing remains active; once it's sold, delisted, or returned, that restriction ends.",
    ],
  },
  {
    id: "pricing-confidentiality",
    heading: "Pricing Confidentiality",
    body: [
      "The artist's listed price for a work is private and is never shown to buyers or the public. Only the final customer-facing price (which includes GalleryZone's markup and applicable GST) is displayed. This confidentiality is enforced at the platform level, not just hidden by the interface.",
      "GalleryZone reserves the right to reject or delist an artwork at any stage, including after it has gone live, if it's found to no longer meet eligibility or quality standards.",
    ],
  },
  {
    id: "payments-wallet",
    heading: "Payments & Wallet",
    body: [
      "Artists are paid the full value of their listed price (100% of it) within 7 days of a confirmed marketplace sale, paid directly to the bank account on file. Delivery charges for marketplace sales are collected from the customer and are never deducted from the artist's payout.",
      "Aggregators earn a share of the markup on artworks they've reserved and sold through their own channel, settled once a recorded sale is confirmed. Withdrawal requests are processed against the balance available in your GalleryZone wallet; minimums and processing timelines are shown in-app at the time of withdrawal.",
      "Transit insurance is available, and strongly recommended, for artworks valued above ₹20,000 (partnered with HDFC ERGO). Uninsured artworks placed with an aggregator for physical display carry no platform liability for accidental loss or damage in transit.",
    ],
  },
  {
    id: "liability",
    heading: "Limitation of Liability",
    body: [
      "GalleryZone facilitates listing, discovery, payment, and logistics for original artwork, but does not guarantee that any given artwork will sell, or set a floor on how quickly it will. To the fullest extent permitted by law, GalleryZone's liability for any claim arising from your use of the platform is limited to the fees actually paid to GalleryZone in connection with that claim.",
      "Where transit insurance has not been opted into for a physical shipment, GalleryZone is not liable for loss or damage occurring in transit.",
    ],
  },
  {
    id: "termination",
    heading: "Termination",
    body: [
      "GalleryZone may suspend or terminate an account, and remove any associated listings, for counterfeit or non-original work, materially false information provided during onboarding or listing, intellectual property infringement, or fraud.",
    ],
  },
  {
    id: "dispute-resolution",
    heading: "Dispute Resolution",
    body: [
      "Most disagreements (over a delivery, a sale record, or a settlement) are resolved directly through GalleryZone support in the first instance. If a dispute can't be resolved that way, it will be handled under the governing law and jurisdiction set out below.",
    ],
  },
  {
    id: "governing-law",
    heading: "Governing Law",
    body: [
      "These Terms are governed by the laws of India. The courts of Hyderabad, Telangana have exclusive jurisdiction over any dispute arising out of or relating to your use of GalleryZone.",
    ],
  },
  {
    id: "changes",
    heading: "Changes to These Terms",
    body: [
      'Amendments to these Terms are made in writing. When they take effect, this page is updated with the revised text and a new "Last updated" date; continued use of GalleryZone after that date constitutes acceptance of the revised Terms.',
    ],
  },
];
