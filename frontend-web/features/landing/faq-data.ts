export type FaqItem = {
  question: string;
  answer: string;
};

// Landing-page FAQ is public and read by anyone. The client (18 Oct 2026)
// asked us to keep profit sharing, pay percentages, and the fee ladder off
// this page — those answers live behind login, on the artist's and the
// aggregator's own Support pages (which read features/faq/faq-data.ts).
// What stays here is only the "is this real, how do I start, can I trust it"
// shape of question a cold visitor would ask.
export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is GalleryZone?",
    answer:
      "A verified marketplace for original artwork, connecting independent artists directly with collectors online and with curated gallery partners for in-person display.",
  },
  {
    question: "How long does verification take?",
    answer:
      "Most submissions are reviewed within 1–3 days. You'll be notified the moment your artwork is approved and goes live on the marketplace.",
  },
  {
    question: "How do I know an artwork is genuine?",
    answer:
      "Every piece ships with a numbered Certificate of Authenticity and a physical NFC/QR tag that resolves to its digital passport — one tap shows its provenance and ownership history.",
  },
  {
    question: "What happens if my artwork doesn't sell?",
    answer:
      "Your listing stays live and free for 6 months. If it hasn't sold by then, it's returned to you, or you can choose to relist it.",
  },
  {
    question: "Can galleries display my work physically?",
    answer:
      "Yes. Verified galleries and aggregators can reserve your artwork for a fixed display period, so your work reaches collectors who prefer to see it in person before buying.",
  },
];
