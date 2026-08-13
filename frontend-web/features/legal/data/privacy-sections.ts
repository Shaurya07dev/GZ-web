import type { LegalSection } from "../types";

// Drafted fresh — no source document exists for Privacy specifically — but
// scoped strictly to what the SAD confirms the platform actually collects
// and how it's handled (§8.7 Sensitive Data Handling, §2.4-2.5), not a
// generic template. Contact details reused verbatim from the Onboarding
// Guide's closing section.
export const privacySections: LegalSection[] = [
  {
    id: "information-we-collect",
    heading: "Information We Collect",
    body: [
      "Identity & KYC documents: for artists, this includes a government ID and Aadhaar number submitted during onboarding. Your Aadhaar number is encrypted at rest and is never exposed through any API. Only your verification status (verified / not verified) is ever visible, including to GalleryZone staff.",
      "Bank account details: collected to pay out artist settlements and aggregator commissions. Your account number is stored masked (shown as, for example, XXXXXXXX1234) everywhere in the product; the full number is only used transiently at the moment a withdrawal is actually processed.",
      "Contact & address details: your name, email, phone number, and any delivery addresses you save for orders or shipments.",
      "Browsing and wishlist activity: which artworks and artists you view and save, used to keep your wishlist in sync and to show you more relevant work.",
    ],
  },
  {
    id: "how-we-use-it",
    heading: "How We Use It",
    body: [
      "To operate your account: authenticating you, verifying artist and aggregator eligibility, processing sales, settlements, and withdrawals, and fulfilling shipments.",
      "To communicate with you: order confirmations, settlement statements, verification status updates, and security notices.",
      "To improve the platform: understanding which artworks and categories collectors engage with, so search, recommendations, and curation get better over time.",
    ],
  },
  {
    id: "who-we-share-it-with",
    heading: "Who We Share It With",
    body: [
      "Payment gateway: to process payments, settlements, and refunds. GalleryZone does not store your full card or payment credentials.",
      "Resend: our transactional email provider, used to deliver account, order, and settlement emails.",
      "Sentry: our error-monitoring provider, used to detect and diagnose bugs. Sentry receives technical error data, not your KYC or payment details.",
      "HDFC ERGO: our transit-insurance partner, only for shipments where you've opted into transit insurance.",
      "We do not sell your personal information to third parties.",
    ],
  },
  {
    id: "data-retention",
    heading: "Data Retention",
    body: [
      "We retain account, transaction, and settlement records for as long as your account is active and for a reasonable period after closure, as needed to meet legal, tax, and accounting obligations. Encrypted KYC data is retained only as long as required to maintain your verification status.",
    ],
  },
  {
    id: "your-rights",
    heading: "Your Rights",
    body: [
      "You can request access to the personal information we hold about you, ask us to correct inaccurate details, or request deletion of your account and associated data, subject to what we're legally required to retain (such as completed transaction records).",
      "To exercise any of these rights, contact us using the details below.",
    ],
  },
  {
    id: "contact",
    heading: "Contact",
    body: [
      "Questions about this Privacy Policy, or requests relating to your personal data, can be sent to galleryzone@zohomail.in.",
    ],
  },
];
