// Audience-organized FAQ content for the dedicated /faq page. This is a
// separate, larger dataset from features/landing/faq-data.ts (which powers
// the landing page's own small FAQ teaser section) — that file is untouched
// by this task. Every answer here is grounded in documented platform
// mechanics (the Artist Onboarding Guide's pricing formula, verification
// tiers, and settlement/insurance terms, plus the Software Architecture
// Document's aggregator reservation and rights-transfer rules), never
// invented copy.

export type FaqAudience = "general" | "artists" | "aggregators" | "buyers";

export interface FaqItem {
  audience: FaqAudience;
  question: string;
  answer: string;
}

export const FAQ_AUDIENCES: { value: FaqAudience; label: string }[] = [
  { value: "general", label: "General" },
  { value: "artists", label: "Artists" },
  { value: "buyers", label: "Buyers" },
];

export const FAQ_ITEMS: FaqItem[] = [
  // General
  {
    audience: "general",
    question: "What is GalleryZone?",
    answer:
      "GalleryZone is a verified marketplace for original artwork. It connects independent artists directly with collectors through an online marketplace, and with curated gallery partners, called aggregators, who can display and sell work in person.",
  },
  {
    audience: "general",
    question: "How is pricing kept private?",
    answer:
      "Every artist sets a private listed price that is never shown to buyers or the public. The marketplace price shown everywhere else already includes GalleryZone's markup, so an artist's confidential price and market value stay protected across every channel.",
  },
  {
    audience: "general",
    question: "What does the Verified badge mean?",
    answer:
      "Verified artists have linked an official social media handle, kept an active GalleryZone plan for three months, and completed at least one confirmed sale. Clearing all three unlocks the Gold ✦ Verified badge, shown on their profile and every listing.",
  },
  {
    audience: "general",
    question: "Is there a fee to list artwork?",
    answer:
      "No. Listing is free, with a 0% confirmation fee when artwork is accepted. GalleryZone earns its margin from the markup on the customer-facing price, never from a submission or listing fee.",
  },
  {
    audience: "general",
    question: "How do I know an artwork is genuine?",
    answer:
      "Every artwork is linked to a Certificate of Authenticity and a signed origin declaration, plus a physical QR and NFC tag that resolves to its digital passport, showing ownership history for the artwork's life cycle.",
  },

  // Artists
  {
    audience: "artists",
    question: "How is the customer price calculated from my listed price?",
    answer:
      "The customer price is your listed price plus a 30% markup, with 5% GST added on top at checkout. On a ₹30,000 listed piece, that's ₹39,000 before GST and ₹40,950 after, excluding delivery, which the customer pays separately. Of the ₹9,000 markup, an aggregator who facilitated the sale earns 20% (₹1,800); GalleryZone keeps the rest to fund the platform.",
  },
  {
    audience: "artists",
    question: "When and how do I get paid?",
    answer:
      "You're paid within 7 days of a confirmed marketplace sale, by direct bank settlement. You receive 100% of your listed price, and delivery charges are collected from the customer rather than deducted from your payout.",
  },
  {
    audience: "artists",
    question: "Should I insure my artwork?",
    answer:
      "Transit insurance is strongly recommended for artwork valued above ₹20,000, through GalleryZone's partner HDFC ERGO. It's mandatory if your listing is displayed through an aggregator; uninsured artwork carries no platform liability for damage in transit.",
  },
  {
    audience: "artists",
    question: "How does the 3-tier verification system work?",
    answer:
      "Tier 1 is linking an official social media handle. Tier 2 is keeping an active GalleryZone plan for three months. Tier 3 is completing your first confirmed sale. Clearing all three unlocks the Gold ✦ Verified badge on your profile and listings.",
  },
  {
    audience: "artists",
    question: "What can't I mention in my listing description?",
    answer:
      "Descriptions, photos, and any linked social proof videos must never mention price or valuation. This keeps pricing confidential platform-wide; violations can result in removed links or delisting.",
  },

  // Aggregators
  {
    audience: "aggregators",
    question: "How does reserving artwork work?",
    answer:
      "You reserve an unclaimed, aggregator-eligible artwork by paying an advance upfront, either 5% or 3% of its price depending on the piece. That secures the display slot and moves it into your collection.",
  },
  {
    audience: "aggregators",
    question: "How long can I display a reserved piece?",
    answer:
      "Reservations run for 30 days from assignment. If the piece hasn't sold by then, the hold expires and it's released back to marketplace availability.",
  },
  {
    audience: "aggregators",
    question: "What's my commission when a reserved piece sells?",
    answer:
      "You earn 20% of the 30% markup on top of the artist's listed price. On a ₹30,000 listed artwork, that markup is ₹9,000, so your commission is ₹1,800.",
  },
  {
    audience: "aggregators",
    question:
      "What happens if I try to reserve a piece someone else just claimed?",
    answer:
      "You'll see a conflict error, \"Artwork no longer available,\" if another aggregator's reservation was confirmed first. It's a real race condition on popular listings, not a bug, so it's worth reserving pieces promptly once you decide.",
  },
  {
    audience: "aggregators",
    question: "Can I change the display price on a piece I'm holding?",
    answer:
      "You can raise it above the marketplace customer price to account for your own presentation or framing costs, but you can never set it below the customer price.",
  },

  // Buyers
  {
    audience: "buyers",
    question: "What rights do I get when I buy a piece?",
    answer:
      "Once your delivery is confirmed, you receive the right to display, reproduce, license, and commercially use or resell the physical artwork.",
  },
  {
    audience: "buyers",
    question: "Does the artist keep any rights after I buy their work?",
    answer:
      "Yes. The artist permanently retains moral rights as the original creator, recorded against the piece regardless of who owns it.",
  },
  {
    audience: "buyers",
    question: "Can I resell art I've bought?",
    answer:
      "Registered customers can resell authenticated artwork through GalleryZone, which supports a secondary market with resale royalties rather than a private, unverifiable sale.",
  },
  {
    audience: "buyers",
    question: "How do I know a piece is authentic before I buy it?",
    answer:
      "Every listing links to a Certificate of Authenticity, a signed origin declaration, and the artwork's NFC/QR passport page, so you can verify its history independently of the listing itself.",
  },
  {
    audience: "buyers",
    question: "Is my order insured in transit?",
    answer:
      "Artwork valued above ₹20,000 is strongly recommended for transit insurance through GalleryZone's partner HDFC ERGO. Look for the insured badge on a listing; delivery charges are billed separately from the artwork price.",
  },
];
