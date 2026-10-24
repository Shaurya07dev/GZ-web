import { CONTACT_EMAIL } from "@/features/contact/contact-data";
import type { LegalSection } from "../types";

// Verbatim from the company's "Galleryzone — General Website Terms & Conditions" document (October 2026), which replaces
// the earlier Terms of Service. Clause numbers and wording are the document's
// own; the bullets under "Acceptable Use" are marked with "•" because
// LegalSectionBlock renders one paragraph per entry.
//
// TODO(legal): the document still has "[Insert ...]" placeholders. These are
// left out here rather than shown on the live page, and need real values:
//   - clause 20: the grievance contact block (designated person, grievance
//     email, postal address, response timeline);
//   - clause 23: the registered office address and the company CIN.
// The contact email below is the one the site already publishes.
export const termsSections: LegalSection[] = [
  {
    id: "introduction",
    heading: "Introduction",
    body: [
      "These General Website Terms & Conditions govern access to and use of the Galleryzone website by all visitors, registered users, artists, aggregators, galleries, customers, collectors, and any other persons using the website.",
      "These terms are a general website-wide framework and do not replace separate agreements or policies applicable to particular transactions.",
    ],
  },
  {
    id: "acceptance-of-terms",
    heading: "1. Acceptance of Terms",
    body: [
      "1.1. By accessing, browsing, registering on, or using the Galleryzone website or its services, you agree to these Terms & Conditions and any applicable policies published on the website.",
      "1.2. If you do not agree to these terms, you must discontinue use of the website and its services.",
      "1.3. Additional terms may apply to particular services, transactions, listings, or contractual relationships. Users must review those terms before proceeding.",
    ],
  },
  {
    id: "about-galleryzone",
    heading: "2. About Galleryzone",
    body: [
      "2.1. Galleryzone operates a digital platform intended to facilitate the discovery, presentation, promotion, and sale of original artworks and related services.",
      "2.2. The website may provide artwork listings, artist profiles, authenticity and provenance information, digital artwork identification, QR/NFC features, communication facilities, and transaction-related services.",
      "2.3. The specific role performed by Galleryzone may vary depending on the relevant transaction and applicable agreement. The role, responsibilities, and obligations of the parties shall be determined by the relevant transaction terms and applicable law.",
    ],
  },
  {
    id: "eligibility-and-user-accounts",
    heading: "3. Eligibility and User Accounts",
    body: [
      "3.1. Users must provide accurate, complete, and current information when creating an account or using services requiring registration.",
      "3.2. Users are responsible for maintaining the confidentiality of their login credentials and for activities undertaken through their accounts.",
      "3.3. Users must promptly notify Galleryzone of suspected unauthorized access, inaccurate account information, or misuse of their accounts.",
      "3.4. Galleryzone may request identity, business, payment, tax, or other verification documents where reasonably necessary for account administration, fraud prevention, transaction processing, or legal compliance.",
      "3.5. Galleryzone may restrict, suspend, or terminate an account where reasonably necessary due to suspected fraud, unlawful activity, material misrepresentation, security concerns, or breach of these terms, subject to applicable law.",
    ],
  },
  {
    id: "acceptable-use",
    heading: "4. Acceptable Use",
    body: [
      "Users agree not to:",
      "• Use the website for unlawful, fraudulent, deceptive, or misleading purposes.",
      "• Submit false information, counterfeit artwork, stolen property, or content that infringes third-party rights.",
      "• Misrepresent identity, ownership, authenticity, provenance, pricing, or authority to conduct a transaction.",
      "• Interfere with website security, functionality, or other users’ access.",
      "• Introduce malicious software or attempt unauthorized access to systems, accounts, or data.",
      "• Copy, scrape, distribute, or commercially exploit website content without authorization, except where permitted by law.",
      "• Use another person's account or personal information without lawful authority.",
      "• Circumvent applicable transaction procedures or engage in activity intended to defraud Galleryzone or other users.",
      "Galleryzone may investigate suspected violations and take reasonable action to protect users, artwork, information, and the website.",
    ],
  },
  {
    id: "website-content-and-intellectual-property",
    heading: "5. Website Content and Intellectual Property",
    body: [
      "5.1. The website's design, branding, logos, software, text, graphics, and other proprietary materials are owned by or licensed to Galleryzone, unless otherwise stated.",
      "5.2. Users may not reproduce, modify, distribute, publish, or commercially exploit Galleryzone's proprietary content without prior authorization, except as permitted by law.",
      "5.3. Copyright and other intellectual property rights in artwork remain with the relevant rights-holder unless expressly transferred or licensed under a separate written agreement.",
      "5.4. Purchasing an artwork does not automatically transfer copyright, reproduction rights, or other intellectual property rights associated with that artwork.",
      "5.5. Users must ensure that any images, descriptions, documents, or other materials they upload are lawfully provided and do not infringe third-party rights.",
    ],
  },
  {
    id: "information-and-website-listings",
    heading: "6. Information and Website Listings",
    body: [
      "6.1. Galleryzone endeavours to present website information accurately and to maintain reasonable processes for reviewing artwork listings and related information.",
      "6.2. Artwork appearance may vary from website images because of photography, lighting, framing, screen settings, or display characteristics.",
      "6.3. Artwork descriptions, dimensions, materials, provenance, certificates, and other details should be reviewed before a transaction is completed.",
      "6.4. Verification procedures, certificates, digital records, QR codes, or NFC identifiers are intended to support identification and provenance. They should not be interpreted as an absolute guarantee against every possible dispute, defect, misrepresentation, or future change in ownership.",
      "6.5. Galleryzone may correct, suspend, or remove website content where information appears inaccurate, incomplete, disputed, unlawful, or inconsistent with platform requirements.",
    ],
  },
  {
    id: "orders-and-transactions",
    heading: "7. Orders and Transactions",
    body: [
      "7.1. Any order, purchase request, booking, or transaction through the website is subject to applicable availability, verification, payment authorization, and transaction-specific conditions.",
      "7.2. Galleryzone may decline, suspend, or cancel a transaction where an item is unavailable, a material listing error exists, payment is unsuccessful, fraud is reasonably suspected, or fulfillment is prohibited or impracticable.",
      "7.3. Where payment has been collected for a transaction that is cancelled, any refund will be handled in accordance with applicable law and the relevant refund policy.",
      "7.4. Users must review the price, applicable taxes, delivery charges, payment terms, and other charges disclosed before confirming a transaction.",
      "7.5. Specific payment, settlement, commission, incentive, deposit, and deduction arrangements between Galleryzone, artists, and aggregators are governed by their applicable separate agreements.",
    ],
  },
  {
    id: "payments-taxes-and-charges",
    heading: "8. Payments, Taxes, and Charges",
    body: [
      "8.1. Payments may be processed through authorized payment service providers. Users must comply with applicable payment instructions and provider terms.",
      "8.2. Users must not use payment methods without authorization or submit false billing or payment information.",
      "8.3. Applicable taxes, including GST where required, and other transaction charges will be handled in accordance with applicable law and the terms disclosed for the relevant transaction.",
      "8.4. Users remain responsible for their own tax obligations unless applicable law or a separate written agreement provides otherwise.",
    ],
  },
  {
    id: "delivery-and-fulfilment",
    heading: "9. Delivery and Fulfilment",
    body: [
      "9.1. Delivery arrangements, estimated timelines, shipping charges, packaging requirements, and delivery conditions will be governed by the relevant order details and applicable shipping policy.",
      "9.2. Delivery estimates are indicative unless expressly confirmed otherwise.",
      "9.3. Users must provide accurate delivery information and cooperate with reasonable delivery and collection procedures.",
      "9.4. International orders may be subject to customs clearance, import duties, taxes, or other destination-related requirements. Responsibility for such charges will be stated in the applicable transaction terms, subject to law.",
      "9.5. Any damage, loss, incorrect delivery, or other material delivery issue should be reported promptly through the official Galleryzone contact channels, with supporting photographs or other available evidence.",
    ],
  },
  {
    id: "cancellation-returns-and-refunds",
    heading: "10. Cancellation, Returns, and Refunds",
    body: [
      "10.1. Cancellation, return, replacement, and refund rights are governed by the applicable order terms, published policies, and mandatory legal requirements.",
      "10.2. Users should review the applicable policy before placing an order, including any stated deadlines, eligibility requirements, exclusions, and return procedures.",
      "10.3. Where a refund is approved, it will ordinarily be processed through the original payment method or another lawful method, subject to applicable processing timelines.",
      "10.4. Nothing in these Terms & Conditions excludes or restricts any consumer right or remedy that cannot lawfully be excluded or restricted.",
    ],
  },
  {
    id: "privacy-and-personal-information",
    heading: "11. Privacy and Personal Information",
    body: [
      "11.1. Galleryzone may collect and process personal information necessary for account administration, verification, transactions, payments, delivery, customer support, security, fraud prevention, and legal compliance.",
      "11.2. Information may be shared with authorized service providers, payment processors, logistics partners, professional advisers, and competent authorities where reasonably necessary or legally required.",
      "11.3. Personal information will be handled in accordance with applicable law and Galleryzone's Privacy Policy.",
      "11.4. Users must not misuse, unlawfully disclose, or access another person's personal information without appropriate authority.",
    ],
  },
  {
    id: "third-party-services-and-links",
    heading: "12. Third-Party Services and Links",
    body: [
      "12.1. The website may contain links to or integrations with third-party websites, payment providers, logistics services, or other external services.",
      "12.2. Third-party services may be subject to their own terms and privacy policies.",
      "12.3. Galleryzone does not control every aspect of third-party services and is not responsible for their independent acts or omissions, except to the extent responsibility is imposed by applicable law or an express written agreement.",
    ],
  },
  {
    id: "website-availability-and-security",
    heading: "13. Website Availability and Security",
    body: [
      "13.1. Galleryzone endeavours to maintain reasonable website availability and security but does not guarantee uninterrupted or error-free operation.",
      "13.2. Access may be temporarily restricted for maintenance, upgrades, technical issues, security incidents, or circumstances beyond Galleryzone's reasonable control.",
      "13.3. Users must not attempt to bypass security controls, interfere with website operations, or gain unauthorized access to systems or data.",
    ],
  },
  {
    id: "disclaimers",
    heading: "14. Disclaimers",
    body: [
      "14.1. Website content is provided for general information and platform use. Users should review transaction-specific information before making a purchase or other commitment.",
      "14.2. Unless expressly stated in a written agreement, Galleryzone does not guarantee that an artwork will sell, appreciate in value, generate income, or achieve a particular resale price.",
      "14.3. Galleryzone does not provide a guarantee of investment returns or future market demand for artwork.",
      "14.4. Nothing in these terms excludes a warranty, statutory protection, or other obligation that cannot lawfully be excluded under applicable law.",
    ],
  },
  {
    id: "limitation-of-liability",
    heading: "15. Limitation of Liability",
    body: [
      "15.1. To the maximum extent permitted by applicable law, Galleryzone will not be liable for indirect or consequential losses arising from website use, including loss of profit or opportunity, where such exclusion is legally permissible.",
      "15.2. Galleryzone is not responsible for loss caused by inaccurate information supplied by a user or by an independent third party, except to the extent that Galleryzone is legally responsible for that loss.",
      "15.3. Nothing in these terms excludes or limits liability for fraud, wilful misconduct, or any other liability that cannot lawfully be excluded or limited.",
    ],
  },
  {
    id: "indemnification",
    heading: "16. Indemnification",
    body: [
      "To the extent permitted by law, a user may be responsible for losses, claims, damages, and reasonable legal costs arising directly from that user's unlawful conduct, fraud, material misrepresentation, infringement of third-party rights, or material breach of these Terms & Conditions.",
      "This provision does not make a user responsible for losses caused by Galleryzone's own conduct where such allocation would be unlawful.",
    ],
  },
  {
    id: "suspension-and-termination",
    heading: "17. Suspension and Termination",
    body: [
      "17.1. Galleryzone may suspend or restrict website access, remove content, or terminate access where reasonably necessary because of a material breach, suspected fraud, unlawful activity, security risk, or legal requirement.",
      "17.2. Where appropriate and legally permissible, Galleryzone may provide notice and an opportunity to address a remediable breach.",
      "17.3. Suspension or termination does not extinguish rights or obligations arising from completed transactions, outstanding payments, valid refund claims, record-retention requirements, or other obligations that continue by their nature.",
    ],
  },
  {
    id: "changes-to-these-terms",
    heading: "18. Changes to These Terms",
    body: [
      "18.1. Galleryzone may update these Terms & Conditions to reflect changes in law, technology, services, or operational requirements.",
      "18.2. The revised version will be published on the website with an updated effective or revision date.",
      "18.3. Where required by law, or where a material change requires renewed consent, Galleryzone will provide appropriate notice and obtain the necessary acceptance.",
      "18.4. Changes will not override mandatory legal rights or retroactively alter completed transactions where doing so is not permitted by law.",
    ],
  },
  {
    id: "force-majeure",
    heading: "19. Force Majeure",
    body: [
      "Galleryzone will not be responsible for delay or failure caused by circumstances beyond its reasonable control, including natural disasters, government action, major service outages, civil disturbances, or logistics interruptions, provided reasonable efforts are made to mitigate the effects and resume affected services.",
      "This clause does not excuse obligations that cannot lawfully be excused.",
    ],
  },
  {
    id: "complaints-and-grievances",
    heading: "20. Complaints and Grievances",
    body: [
      "20.1. Users may submit complaints through the official contact details published on the Galleryzone website.",
      "20.2. Complaints should include the user's contact information, relevant order or listing reference, a description of the issue, and supporting documents where available.",
      "20.3. Galleryzone will review complaints and respond in accordance with its applicable procedures and legal obligations.",
    ],
  },
  {
    id: "governing-law-and-jurisdiction",
    heading: "21. Governing Law and Jurisdiction",
    body: [
      "21.1. These Terms & Conditions are governed by the laws of India.",
      "21.2. Subject to mandatory legal requirements, including applicable consumer-protection rights and forum rules, competent courts at Hyderabad, Telangana, India, shall have jurisdiction over disputes arising from these Terms.",
      "21.3. Nothing in this clause prevents a consumer from approaching a consumer commission or another competent forum where permitted by applicable law.",
    ],
  },
  {
    id: "general-provisions",
    heading: "22. General Provisions",
    body: [
      "22.1. If any provision of these Terms is found unenforceable, the remaining provisions will continue to apply to the extent permitted by law.",
      "22.2. Failure to enforce a provision does not constitute a waiver of the right to enforce it later.",
      "22.3. These Terms do not create a partnership, employment relationship, joint venture, or general agency between Galleryzone and any user.",
      "22.4. Users may not represent that they are authorized to bind Galleryzone unless expressly authorized in writing.",
      "22.5. These Terms must be read alongside any applicable Privacy Policy, Shipping Policy, Cancellation/Returns/Refund Policy, and other applicable terms published by Galleryzone.",
    ],
  },
  {
    id: "contact-information",
    heading: "23. Contact Information",
    body: [
      "For questions, complaints, or requests relating to these Terms & Conditions, please contact:",
      "Galleryzone Private Limited",
      "Website: www.galleryzone.art",
      "Email: " + CONTACT_EMAIL,
    ],
  },
];
