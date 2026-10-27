// Hardcoded Q&A for the help assistant. Fuzzy-matched against the user's
// query in features/assistant/fuzzy-match.ts. Keep answers short (1–3
// sentences). The `audience` tag lets a future version filter to the
// signed-in role; for v1 we fuzzy-match across the whole set.
//
// Editing policy: this file is the single source of truth. Add an entry here
// to teach the assistant a new answer. No code changes needed.

export type FaqAudience = "everyone" | "customer" | "artist" | "aggregator";

export interface FaqEntry {
  /** The canonical question. Shown as a suggested starter + used in matching. */
  question: string;
  /** Common alternate phrasings. Boosts matching for the same concept worded differently. */
  aliases?: string[];
  /** Keywords that help the fuzzy matcher. Short — nouns/concepts in the question. */
  tags?: string[];
  /** The answer. Markdown is NOT rendered — plain text, keep it to a few sentences. */
  answer: string;
  audience: FaqAudience;
}

export const FAQ_KNOWLEDGE_BASE: FaqEntry[] = [
  // --- Everyone ---------------------------------------------------------------
  {
    audience: "everyone",
    question: "What is GalleryZone?",
    aliases: ["who are you", "what does this platform do", "what's this site"],
    tags: ["about", "platform"],
    answer:
      "GalleryZone is a marketplace for original artwork from Indian artists. Every piece ships with a Certificate of Authenticity and an NFC/QR tag so buyers can verify what they own. Artists sell direct to collectors or through partner galleries (aggregators).",
  },
  {
    audience: "everyone",
    question: "How do I contact support?",
    aliases: ["where's help", "customer service", "need help", "support email"],
    tags: ["support", "contact"],
    answer:
      "Open the Support tab in your sidebar — artists at /dashboard/support, aggregators at /aggregator/support, collectors at /account/support. Or email support@galleryzone.art.",
  },
  {
    audience: "everyone",
    question: "What is a Certificate of Authenticity (COA)?",
    aliases: ["what's a coa", "coa", "certificate", "authenticity certificate"],
    tags: ["coa", "certificate", "authenticity"],
    answer:
      "A unique digital certificate GalleryZone issues for every artwork, tied to the piece's NFC chip. It records the artist, dimensions, medium, and ownership history. You can view it on the public /verify/<artworkId> page, and request a printed version from the artist.",
  },
  {
    audience: "everyone",
    question: "What is the NFC tag for?",
    aliases: ["nfc tag", "qr code", "how do i scan", "chip", "verify my piece"],
    tags: ["nfc", "tag", "verify", "scan"],
    answer:
      "Every physical artwork carries an NFC chip (and a QR code backup). Scanning either opens the piece's public passport — artist, provenance, current owner, display history. Tap a tag with any phone or scan the QR with your camera.",
  },
  {
    audience: "everyone",
    question: "How does GST work on prices?",
    aliases: ["gst", "tax", "prices include tax", "incl gst"],
    tags: ["gst", "tax", "pricing"],
    answer:
      "Prices shown to buyers already include 5% GST on the final sale price. The artist's listed price and the aggregator's offer price are shown before GST — GalleryZone adds it at checkout. You'll see 'incl. GST' labels on every customer-facing price.",
  },
  {
    audience: "everyone",
    question: "How does GalleryZone protect my payment?",
    aliases: ["escrow", "payment protection", "is it safe to buy", "secure payment"],
    tags: ["escrow", "payment", "security"],
    answer:
      "Payments flow through Razorpay and sit in GalleryZone's escrow until the artwork is delivered. Artists are paid 7 days after delivery, aggregators receive their commission after remittance. Refunds go back to your original payment method.",
  },

  // --- Customer ---------------------------------------------------------------
  {
    audience: "customer",
    question: "How do I buy an artwork?",
    aliases: ["buy a piece", "purchase", "how to buy", "check out"],
    tags: ["buy", "purchase", "checkout"],
    answer:
      "Browse /marketplace, click an artwork, then 'Buy'. You'll go through checkout — pick a shipping address and pay via Razorpay. The piece moves to 'My Collection' once delivered.",
  },
  {
    audience: "customer",
    question: "How long does delivery take?",
    aliases: ["shipping time", "when will it arrive", "delivery estimate"],
    tags: ["shipping", "delivery", "when"],
    answer:
      "GalleryZone ships through ShipRocket. Most pieces reach you within 5–10 working days depending on your pincode. You can track the shipment in /account/orders — the stage updates (pickup → in transit → out for delivery → delivered) come straight from the courier.",
  },
  {
    audience: "customer",
    question: "What's the return / refund policy?",
    aliases: ["return", "refund", "cancel order", "money back"],
    tags: ["refund", "return", "cancel"],
    answer:
      "Original artworks are generally non-returnable because each is unique. Exceptions: damage in transit or a mismatch from the listing. Open a Support ticket within 48 hours of delivery with photos. Approved refunds go back to the original payment method.",
  },
  {
    audience: "customer",
    question: "Can I resell an artwork I bought?",
    aliases: ["resell", "sell again", "secondary sale", "list my piece"],
    tags: ["resale", "resell", "sell"],
    answer:
      "Yes — go to /account/resale, pick a piece from your collection, set a listed price. GalleryZone verifies the piece is still with you, lists it on the resale market, and handles the ownership transfer when it sells.",
  },
  {
    audience: "customer",
    question: "How do I transfer ownership of a piece?",
    aliases: ["gift artwork", "transfer rights", "give to someone"],
    tags: ["transfer", "ownership", "gift"],
    answer:
      "In /account/coa-nfc or your collection detail, pick the piece and click 'Transfer rights'. Enter the recipient's email — they get a link to accept. The COA updates with the new owner once they accept.",
  },
  {
    audience: "customer",
    question: "What happens to the COA and NFC after I buy?",
    aliases: ["coa after purchase", "nfc after buying", "my certificate"],
    tags: ["coa", "nfc", "purchase"],
    answer:
      "Both move with ownership automatically. The COA updates to list you as the current owner, and the NFC chip stays on the piece — anyone scanning it sees you as the holder. If you ever sell or transfer, the records update again.",
  },
  {
    audience: "customer",
    question: "Where do I see my orders?",
    aliases: ["my orders", "past purchases", "order history"],
    tags: ["orders", "history"],
    answer: "Collector portal → Orders. Each row shows status, shipment stage, invoice link, and the piece itself.",
  },

  // --- Artist -----------------------------------------------------------------
  {
    audience: "artist",
    question: "How do I submit my first artwork?",
    aliases: ["upload artwork", "add a piece", "first submission", "list art"],
    tags: ["submit", "upload", "list"],
    answer:
      "First complete your Profile — KYC, bank, GST, and the Artist MOU. All four are required. Then go to Add Artwork from the sidebar: fill in title, medium, dimensions, year, upload photos, set your take-home price. GalleryZone's markup is added on top for the buyer.",
  },
  {
    audience: "artist",
    question: "What is the Artist MOU?",
    aliases: ["artist agreement", "mou", "sign agreement", "contract"],
    tags: ["mou", "agreement", "contract"],
    answer:
      "The Memorandum of Understanding between you and GalleryZone — commission rate, payment terms, insurance, dispute handling. You sign it digitally from your Profile page. It's updated periodically; new versions require a fresh signature before you can submit new work.",
  },
  {
    audience: "artist",
    question: "When do I get paid?",
    aliases: ["artist payout", "when do i receive money", "settlement timing"],
    tags: ["payout", "payment", "earnings"],
    answer:
      "7 days after the buyer confirms delivery. The amount lands in the bank account on your Profile. You can see pending vs cleared settlements in Earnings.",
  },
  {
    audience: "artist",
    question: "How is the price calculated?",
    aliases: ["pricing", "markup", "how is price set"],
    tags: ["pricing", "markup", "price"],
    answer:
      "You set your take-home price (the Artist Price). GalleryZone adds a 30% platform markup, and the final customer price is that + 5% GST. So an artist price of ₹10,000 becomes a ₹13,650 customer price.",
  },
  {
    audience: "artist",
    question: "Can I set my own price?",
    aliases: ["change my price", "set price"],
    tags: ["price", "pricing"],
    answer:
      "Yes — the Artist Price is yours to set. GalleryZone's markup and GST are added on top; you don't control those. Prices lock once a piece is listed; to change it, un-list and re-list.",
  },
  {
    audience: "artist",
    question: "Do I need GST registration?",
    aliases: ["gst number", "gstin", "do i need gst"],
    tags: ["gst", "gstin", "tax"],
    answer:
      "Yes — artists must provide a valid GSTIN before submitting work. Add it on your Profile; GalleryZone verifies it (usually within 24 hours) before you can list.",
  },
  {
    audience: "artist",
    question: "What is an aggregator?",
    aliases: ["gallery partner", "who are aggregators", "partner gallery"],
    tags: ["aggregator", "partner", "gallery"],
    answer:
      "Partner galleries that reserve your pieces to physically display and sell. They pay a 5% advance to reserve, keep the piece for 30 days, and if sold you still get your artist price. They earn a commission; you don't pay anything extra.",
  },
  {
    audience: "artist",
    question: "How does the NFC tag get on my artwork?",
    aliases: ["where do i get nfc", "nfc chip for artist", "attach tag"],
    tags: ["nfc", "tag", "chip"],
    answer:
      "GalleryZone ships you NFC chips after your first artwork is approved. You attach one to each piece (back of frame / tag on sculpture) and link it in COA & NFC. Once linked, you lock it from the GalleryZone mobile app — a locked tag can never be re-written.",
  },

  // --- Aggregator -------------------------------------------------------------
  {
    audience: "aggregator",
    question: "How do I reserve an artwork?",
    aliases: ["reserve a piece", "take a piece", "add to inventory"],
    tags: ["reserve", "reservation", "inventory"],
    answer:
      "Go to Browse GalleryZone, pick a piece, click Reserve. You'll pay the 5% advance plus delivery deposit through Razorpay. The piece moves to My Inventory for 30 days; if it doesn't sell, it moves to the next aggregator and your advance is refunded.",
  },
  {
    audience: "aggregator",
    question: "How much is the advance to reserve?",
    aliases: ["reservation fee", "advance amount", "how much to reserve"],
    tags: ["advance", "reserve", "fee"],
    answer:
      "5% of the selling price (before GST) + a delivery deposit. Example: ₹13,000 selling price → ₹650 advance + delivery deposit (varies by weight/distance). Paid once per reservation via Razorpay.",
  },
  {
    audience: "aggregator",
    question: "How long can I keep a reserved piece?",
    aliases: ["holding period", "how long do i have", "placement window"],
    tags: ["placement", "window", "duration"],
    answer:
      "30 days per aggregator per piece. If it doesn't sell in that window, the piece moves on to the next aggregator at a slightly reduced price. You can request a window extension — GalleryZone decides case by case.",
  },
  {
    audience: "aggregator",
    question: "What is the commission on a sale?",
    aliases: ["aggregator commission", "my cut", "how much do i earn"],
    tags: ["commission", "earnings", "cut"],
    answer:
      "20% of the markup above the artist price (not of the full sale). Example: artist price ₹10,000, you sell at ₹13,000 → you earn 20% of ₹3,000 = ₹600. GalleryZone handles GST + the rest of the economics.",
  },
  {
    audience: "aggregator",
    question: "How do I record a sale?",
    aliases: ["record sale", "sold a piece", "mark as sold"],
    tags: ["sale", "sold", "record"],
    answer:
      "In My Inventory, open the piece and click Record Sale. Enter the buyer's name, email, phone, delivery address, and payment route (direct to GalleryZone, or cash collected by you). The piece becomes 'pending settlement' and your commission is calculated.",
  },
  {
    audience: "aggregator",
    question: "What is a display space?",
    aliases: ["gallery space", "venue", "where to display"],
    tags: ["display", "space", "venue"],
    answer:
      "The physical locations you'll show pieces at — gallery address, event booth, pop-up. Register them in Display Spaces so GalleryZone knows where each piece is going. Admin verifies each address once.",
  },
  {
    audience: "aggregator",
    question: "When do I get paid my commission?",
    aliases: ["aggregator payout", "when do i receive commission"],
    tags: ["payout", "commission", "payment"],
    answer:
      "After the sale is remitted and the buyer confirms delivery. GalleryZone transfers your commission to the bank account on your Profile. Pending vs paid amounts show in Earnings.",
  },
  {
    audience: "aggregator",
    question: "How do I report a damaged piece?",
    aliases: ["damaged artwork", "wrong piece", "piece has an issue"],
    tags: ["report", "issue", "damaged"],
    answer:
      "Open the holding in My Inventory and click Report Issue. Pick an issue type (damaged, wrong piece, COA/NFC problem, etc.) and describe what's wrong. Admin reviews it and gets back to you with a resolution.",
  },
];
