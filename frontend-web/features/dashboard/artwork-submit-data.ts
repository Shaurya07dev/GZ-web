import type { ListingType } from "@/types/artwork";
import { REGIONAL_PAINTING_STYLES } from "@/features/artist-survey/artist-survey-data";
import { PAINTING_ART_FORMS } from "./painting-art-forms";

// Paintings only (owner directive, repeated 5 Nov 2026): GalleryZone
// currently only accepts paintings, so every other category — sculpture,
// digital, printmaking, textile, ceramics, mixed-media — is hidden
// everywhere (dropdown here, backend validation, admin moderation,
// marketplace filters). Re-add them once the business model expands.
export const ARTWORK_CATEGORIES = [
  { value: "painting", label: "Painting" },
];

// Artwork type: the 28 regional Indian traditions from the artist survey (client, 19 Oct 2026) plus the 97
// world art forms (client, 14 Nov 2026: "not only Indian art"), then "Other" with a free-text field. The
// value stored (and printed on the COA) is the label itself, e.g. "Rajasthan: Phad Painting" or "Ukiyo-e".
// The Indian labels carry a "State: " prefix, so no label appears twice. Region and category of a world form
// are search keywords only, so typing "Japan" or "Tribal Art" finds it.
export type ArtworkTypeGroup = "india" | "world" | "other";
export interface ArtworkTypeOption {
  value: string;
  label: string;
  group: ArtworkTypeGroup;
  keywords?: string;
}
export const ARTWORK_TYPES: ArtworkTypeOption[] = [
  ...REGIONAL_PAINTING_STYLES.map((name): ArtworkTypeOption => ({ value: name, label: name, group: "india" })),
  ...PAINTING_ART_FORMS.map(
    (form): ArtworkTypeOption => ({ value: form.name, label: form.name, group: "world", keywords: `${form.region} ${form.category}` }),
  ),
  { value: "other", label: "Other", group: "other" },
];
export const ARTWORK_TYPE_GROUPS: { group: ArtworkTypeGroup; heading: string }[] = [
  { group: "india", heading: "Indian art, by state" },
  { group: "world", heading: "World art forms" },
  { group: "other", heading: "Something else" },
];

export const DIMENSION_UNITS = [
  { value: "in", label: "in" },
  { value: "cm", label: "cm" },
];

// Painting-only mediums (bronze, ceramic-mixed-media dropped 5 Nov 2026).
export const ARTWORK_MEDIUMS = [
  { value: "oil-on-canvas", label: "Oil on Canvas" },
  { value: "acrylic-on-canvas", label: "Acrylic on Canvas" },
  { value: "watercolor", label: "Watercolor" },
  { value: "gouache", label: "Gouache" },
  { value: "tempera", label: "Tempera" },
  { value: "pastel", label: "Pastel" },
  { value: "charcoal", label: "Charcoal" },
  { value: "ink", label: "Ink" },
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

// Surface/format the work is made on. Free-ish list rather than a rigid enum —
// an aggregator needs to know what they are hanging, not a taxonomy.
export const ARTWORK_FORMATS = [
  { value: "canvas", label: "Canvas" },
  { value: "paper", label: "Paper" },
  { value: "board", label: "Board / panel" },
  { value: "wood", label: "Wood" },
  { value: "metal", label: "Metal" },
  { value: "stone", label: "Stone" },
  { value: "textile", label: "Textile" },
  { value: "other", label: "Other" },
];

export const MAX_ARTWORK_IMAGES = 8;

// Client (14 Nov 2026): at least three photos are recommended, not required. A listing can still be
// saved with fewer, so this only drives the guidance on the form.
export const RECOMMENDED_ARTWORK_IMAGES = 3;

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
