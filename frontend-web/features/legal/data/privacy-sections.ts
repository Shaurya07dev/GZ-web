import type { LegalSection } from "../types";

// This policy describes the data paths that exist in the web app, mobile app
// and API. Keep the native copy in mobile/lib/features/legal/data in sync.
export const privacySections: LegalSection[] = [
  {
    id: "information-we-collect",
    heading: "Information We Collect",
    body: [
      "Account and contact information: your name, email address, phone number, role, account identifiers, and the delivery or pickup addresses you choose to save.",
      "Artist and gallery information: profile details, portfolio links, artwork images and descriptions, blog submissions, PAN or GSTIN where applicable, and the signature you provide when accepting an agreement.",
      "Identity-verification results: Aadhaar verification takes place through a DigiLocker consent flow operated by our verification provider. GalleryZone does not ask the app to send a full Aadhaar number. We retain the masked number, verification status, provider reference, verified name, and limited evidence needed for review.",
      "Payout information: artists may provide a bank account number and IFSC for settlements. The full account number is kept in a restricted server-side financial record; the app and ordinary profile APIs receive only a masked value.",
      "Orders and platform activity: purchases, payments, refunds, delivery and ShipRocket tracking events, settlements, resale or ownership-transfer requests, saved artwork and followed-artist preferences, support messages, and NFC/QR passport actions.",
      "Device-only preferences: some settings, saved artwork and followed-artist choices are stored on that device and are not currently synchronized to your GalleryZone account.",
    ],
  },
  {
    id: "how-we-use-it",
    heading: "How We Use It",
    body: [
      "To create and secure accounts, provide the marketplace and role-specific portals, verify eligibility, process purchases and refunds, administer settlements, fulfil shipments, maintain artwork provenance, and respond to support or deletion requests.",
      "To send transactional messages such as authentication, order, shipment, agreement, verification and settlement notices.",
      "To prevent fraud, enforce platform rules, diagnose failures, maintain audit and financial records, and improve the reliability of GalleryZone.",
    ],
  },
  {
    id: "who-we-share-it-with",
    heading: "Who We Share It With",
    body: [
      "Firebase processes account authentication. Razorpay processes checkout payments and refunds; GalleryZone does not receive or store your full card, UPI PIN or other payment credentials.",
      "Cashfree Secure ID processes GSTIN lookups and DigiLocker consent-based identity verification. ShipRocket and its assigned couriers receive the contact, address, parcel and order details needed to arrange delivery.",
      "Resend delivers transactional email. Sentry may receive limited technical error information from our servers; it is configured not to send default personal information. Amazon receives information under its own policies when you choose to open an affiliate product link.",
      "We do not sell personal information. We may disclose information when required by law, to protect users or the platform, or as part of a business reorganisation subject to applicable safeguards.",
    ],
  },
  {
    id: "security",
    heading: "Security",
    body: [
      "Production app traffic uses HTTPS. Mobile refresh tokens are stored using the operating system's protected credential storage, and sensitive profile fields are excluded from public artist and artwork records.",
      "No online system is risk-free. If you believe your account or personal information has been compromised, contact GalleryZone immediately.",
    ],
  },
  {
    id: "data-retention",
    heading: "Data Retention",
    body: [
      "We retain account data while your account is active and for the time reasonably needed to provide the service. After an account-deletion request is completed, data that is not subject to a legal or operational retention duty is deleted or de-identified.",
      "Transaction, tax, settlement, provenance, fraud-prevention and dispute records may be retained after account closure where applicable law or a legitimate compliance need requires it. We limit retained records to that purpose and period.",
    ],
  },
  {
    id: "your-rights",
    heading: "Your Rights and Account Deletion",
    body: [
      "You can request access to or correction of your personal information, or request deletion of your GalleryZone account and associated data, subject to records we are legally required to retain.",
      "In the mobile app, open your portal settings and select Delete account. You can also start a deletion request at https://www.galleryzone.art/account-deletion. GalleryZone confirms completion by email after required financial, shipment or dispute items have been reconciled.",
    ],
  },
  {
    id: "contact",
    heading: "Contact",
    body: [
      "Questions about this Privacy Policy or personal-data requests can be sent to galleryzone@zohomail.in.",
    ],
  },
];
