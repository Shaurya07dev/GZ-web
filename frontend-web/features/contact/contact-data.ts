// Three buttons, not a dropdown — mirrors the account-type picker on
// /register (features/auth/data/role-options.ts) since these are the same
// three audiences GalleryZone actually serves.
export const ROLE_OPTIONS = [
  { value: "artist", label: "Artist" },
  { value: "aggregator", label: "Gallery / Aggregator" },
  { value: "collector", label: "Collector" },
] as const;

export const CONTACT_EMAIL = "hello@galleryzone.com";
