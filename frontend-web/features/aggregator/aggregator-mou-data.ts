// The aggregator's Memorandum of Understanding with GalleryZone, transcribed
// from the signed PDF ("GZ_MOU_ Aggregator.pdf") clause for clause. Separate
// document from the artist's MOU: this one governs custody, display and the
// aggregator's incentive, not artwork submission.
//
// Wording is the company's. Amend the source document and re-transcribe rather
// than editing here, so the screen and the paper version cannot diverge.

import type { MouClause, MouDocument } from "@/features/mou/mou-agreement";

export const AGGREGATOR_MOU_VERSION = "2026.1";

const PREAMBLE = [
  "This Memorandum of Understanding (“MOU”) establishes the business relationship between GalleryZone Private Limited and the Authorized Art Partner / Aggregator.",
  "It covers displaying, promoting, and facilitating the sale of artworks and related products through GalleryZone's aggregator platform.",
];

const CLAUSES: MouClause[] = [
  {
    number: 1,
    title: "Purpose",
    paragraphs: [
      "This MOU establishes the business relationship between GalleryZone and the Aggregator for displaying, promoting, and facilitating the sale of artworks and related products through GalleryZone's aggregator platform.",
    ],
  },
  {
    number: 2,
    title: "Business Model",
    paragraphs: [
      "GalleryZone operates as an art e-commerce platform connecting artists, suppliers, distributors, galleries, and customers through a centralized online platform.",
      "The Aggregator acts only as an authorized display and sales support partner and is not the owner of the artworks displayed.",
    ],
  },
  {
    number: 3,
    title: "Ownership of Products",
    paragraphs: [
      "All artworks and products supplied through GalleryZone shall remain the sole property of the Artist until successfully delivered to the customer.",
      "The Aggregator shall:",
    ],
    points: [
      "Display artworks professionally.",
      "Protect them from damage.",
      "Not sell independently.",
      "Not transfer ownership.",
      "Not alter pricing without written approval.",
    ],
    closing: [
      "Ownership transfers only after full customer payment and successful delivery confirmation.",
    ],
  },
  {
    number: 4,
    title: "Inventory Custody",
    paragraphs: [
      "GalleryZone may place inventory at the Aggregator's premises for display. The Aggregator can also place orders through the GalleryZone website or application.",
      "Artwork shall remain in the Aggregator's inventory for only 30 days unless otherwise approved, and shall be returned upon request.",
      "The Aggregator shall:",
    ],
    points: [
      "Maintain inventory safely.",
      "Report damage immediately.",
      "Permit audits.",
      "Return inventory when requested.",
    ],
  },
  {
    number: 5,
    title: "Customer Orders",
    paragraphs: [
      "All customer orders shall be processed exclusively through GalleryZone.",
      "GalleryZone shall issue invoices, collect payments, coordinate logistics, and manage customer communication.",
    ],
  },
  {
    number: 6,
    title: "Pricing Policy",
    paragraphs: [
      "Pricing shall be determined solely by GalleryZone. The Aggregator gets only one opportunity to determine the listed selling price at checkout through the GalleryZone portal.",
      "Unauthorized discounts or price changes are prohibited.",
    ],
  },
  {
    number: 7,
    title: "Security Deposit / Advance",
    paragraphs: [
      "The Aggregator shall pay 5% of the artwork value along with applicable delivery charges as a security deposit before taking possession for display.",
      "This amount shall be adjusted upon successful sale.",
    ],
  },
  {
    number: 8,
    title: "Incentive Structure",
    paragraphs: [
      "The Aggregator shall receive 20% of the difference between the Artist Price and the GalleryZone / Aggregator Listed Price.",
      "Profit Share = 20% × (Listed Price − Artist Price).",
      "Additional commission, if any, shall be determined solely by GalleryZone.",
      "Payment becomes due only after full customer payment, successful delivery, and completion of any return or cancellation period.",
    ],
  },
  {
    number: 9,
    title: "Delivery",
    paragraphs: [
      "Delivery shall be arranged through authorized logistics partners.",
      "Shipping charges shall be borne by the customer unless otherwise specified.",
    ],
  },
  {
    number: 10,
    title: "Responsibilities",
    paragraphs: ["GalleryZone shall be responsible for:"],
    points: [
      "Product sourcing.",
      "Inventory management.",
      "Pricing.",
      "Customer billing.",
      "Marketing.",
      "Payment settlement.",
      "Technology platform.",
    ],
    closing: [
      "The Aggregator shall nominate one GalleryZone coordinator and be responsible for product display, customer assistance, inventory safety, local promotion, and order coordination.",
    ],
  },
  {
    number: 11,
    title: "Warranty & Authenticity",
    paragraphs: [
      "GalleryZone shall ensure genuine sourcing. The Aggregator shall not issue independent warranties.",
    ],
  },
  {
    number: 12,
    title: "Confidentiality",
    paragraphs: [
      "Both parties shall maintain confidentiality of business information.",
    ],
  },
  {
    number: 13,
    title: "Intellectual Property",
    paragraphs: [
      "All GalleryZone intellectual property remains its exclusive property.",
    ],
  },
  {
    number: 14,
    title: "Term",
    paragraphs: [
      "Valid for one year with automatic renewal unless terminated with 30 days' written notice.",
    ],
  },
  {
    number: 15,
    title: "Termination",
    paragraphs: [
      "Immediate termination for fraud, misrepresentation, unauthorized sale, negligence, confidentiality breach, or misuse of GalleryZone property.",
    ],
  },
  {
    number: 16,
    title: "Governing Law",
    paragraphs: [
      "Governed by the laws of India. Jurisdiction: Hyderabad, Telangana.",
    ],
  },
  {
    number: 17,
    title: "Dispute Resolution",
    paragraphs: [
      "Disputes shall first be resolved mutually, failing which arbitration shall take place in Hyderabad under the Arbitration and Conciliation Act, 1996.",
    ],
  },
  {
    number: 18,
    title: "Force Majeure",
    paragraphs: [
      "Neither party shall be liable for delays caused by events beyond reasonable control.",
    ],
  },
  {
    number: 19,
    title: "Entire Understanding",
    paragraphs: [
      "This MOU constitutes the complete understanding and may be amended only in writing signed by both parties.",
    ],
  },
];

const DECLARATION = [
  "I have read this Memorandum of Understanding.",
  "I understand every clause.",
  "I accept the custody, pricing and settlement terms set out above.",
  "I confirm I am authorized to sign on behalf of the aggregator business.",
];

export const AGGREGATOR_MOU: MouDocument = {
  title: "Aggregator Memorandum of Understanding",
  version: AGGREGATOR_MOU_VERSION,
  intro:
    "Your partner agreement with GalleryZone. Read it in full, then sign.",
  preamble: PREAMBLE,
  clauses: CLAUSES,
  declaration: DECLARATION,
};
