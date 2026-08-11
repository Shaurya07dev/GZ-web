export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Is there a fee to list my artwork?",
    answer:
      "No — listing is completely free. GalleryZone takes its margin from the markup on the customer-facing price, never a fee for submission or listing.",
  },
  {
    question: "How long does verification take?",
    answer:
      "Most submissions are reviewed within 1–3 days. You'll be notified the moment your artwork is approved and goes live on the marketplace.",
  },
  {
    question: "How and when do I get paid?",
    answer:
      "You receive 100% of your listed price, paid directly to your bank account within 7 days of a confirmed sale — shipping and platform costs are never deducted from your payout.",
  },
  {
    question: "What happens if my artwork doesn't sell?",
    answer:
      "Your listing stays live and free for 6 months. If it hasn't sold by then, it's returned to you, or you can choose to relist it.",
  },
  {
    question: "Can galleries display my work physically?",
    answer:
      "Yes. Verified galleries and aggregators can reserve your artwork for up to 30 days, paying you an advance upfront while it's on physical display.",
  },
];
