import type { ListingType } from "@/types/artwork";

export const ARTWORK_CATEGORIES = [
  { value: "painting", label: "Painting" },
  { value: "sculpture", label: "Sculpture" },
  { value: "photography", label: "Photography" },
  { value: "printmaking", label: "Printmaking" },
  { value: "mixed-media", label: "Mixed Media" },
  { value: "textile", label: "Textile Art" },
  { value: "ceramics", label: "Ceramics" },
];

export const ARTWORK_MEDIUMS = [
  { value: "oil-on-canvas", label: "Oil on Canvas" },
  { value: "acrylic-on-canvas", label: "Acrylic on Canvas" },
  { value: "watercolor", label: "Watercolor" },
  { value: "charcoal", label: "Charcoal" },
  { value: "ink", label: "Ink" },
  { value: "bronze", label: "Bronze" },
  { value: "ceramic-mixed-media", label: "Ceramic & Mixed Media" },
  { value: "other", label: "Other" },
];

export const LISTING_TYPES: {
  value: ListingType;
  label: string;
  description: string;
}[] = [
  {
    value: "marketplace_only",
    label: "Marketplace",
    description: "Sell online through GalleryZone's own marketplace.",
  },
  {
    value: "aggregator_only",
    label: "Aggregator",
    description:
      "Send the physical piece to a verified aggregator to display and sell in person.",
  },
  {
    value: "marketplace_and_aggregator",
    label: "Both",
    description:
      "List online and make the piece available for aggregator display at the same time.",
  },
];

export const MAX_ARTWORK_IMAGES = 8;
export const INSURANCE_RECOMMENDED_THRESHOLD = 20000;
export const CUSTOMER_MARKUP_MULTIPLIER = 1.3;

// Stock photos pre-filling every image slot so the upload form is always
// submittable with zero clicks (there's no backend to actually store a
// photo either way) — picking a real file swaps a slot's placeholder for a
// real preview via FileReader, but nothing is ever required.
export const PLACEHOLDER_ARTWORK_IMAGES = [
  "/ecosystem/artwork-1.png",
  "/ecosystem/artwork-2.png",
  "/ecosystem/artwork-3.png",
  "/artworks/framed-painting.png",
  "/artworks/landscape.png",
  "/artworks/portrait-woman.png",
  "/artworks/collage-busts.png",
  "/artworks/draped-figure.png",
];
