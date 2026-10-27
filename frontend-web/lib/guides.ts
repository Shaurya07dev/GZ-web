// The explainers in public/guides/. Each is one self-contained HTML file (its
// own styles, scenes, narration through the browser's text-to-speech and a
// language switch), so it plays the same in a dialog as in its own tab. Only
// the order-fulfilment one has a sibling: its video sits in guides/media/.

export interface Guide {
  title: string;
  /** What it covers, in a line. Also the dialog's description. */
  blurb: string;
  /** Length and languages, e.g. "13 steps · English / हिन्दी". */
  meta: string;
  src: string;
}

export const GUIDES = {
  orderFulfilment: {
    title: "Artwork order fulfilment",
    blurb:
      "Sign the artwork, label the back, attach the NFC tag, then pack it and hand it to the delivery agent.",
    meta: "10 steps · हिन्दी / English",
    src: "/guides/order-fulfilment.html",
  },
  aggregatorProcess: {
    title: "The aggregator process",
    blurb:
      "How the aggregator channel works for you: what to prepare, the 30-day rotation, and when you are paid.",
    meta: "13 steps · English / हिन्दी",
    src: "/guides/aggregator-process.html",
  },
  gstRegistration: {
    title: "GST registration in 2 minutes",
    blurb:
      "Register on the government GST portal, step by step. For paintings, use HSN 9701.",
    meta: "About 2 min · English / हिन्दी",
    src: "/guides/gst-registration.html",
  },
  aggregatorWalkthrough: {
    title: "Aggregator walkthrough",
    blurb: "Everything an aggregator does, from browsing to payout.",
    meta: "14 steps · English / हिन्दी",
    src: "/guides/aggregator-walkthrough.html",
  },
  returnPacking: {
    title: "How to pack a painting for return",
    blurb:
      "Pack an unsold painting to go back once the 30 days are up, from the Shipping section to the delivery partner.",
    meta: "6 steps · 5 languages",
    src: "/guides/return-packing.html",
  },
} satisfies Record<string, Guide>;

/** What each portal's Support page lists. */
export const GUIDES_FOR = {
  artists: [
    GUIDES.orderFulfilment,
    GUIDES.aggregatorProcess,
    GUIDES.gstRegistration,
  ],
  aggregators: [
    GUIDES.aggregatorWalkthrough,
    GUIDES.returnPacking,
    GUIDES.gstRegistration,
  ],
} satisfies Record<string, Guide[]>;
