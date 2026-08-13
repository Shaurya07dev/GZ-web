import type { LegalSection } from "../types";

export interface CookieCategory {
  category: string;
  examples: string;
  purpose: string;
}

// Deliberately only two rows: this product genuinely doesn't run analytics
// cookies yet (see the "overview" section's explicit statement below) — a
// third placeholder "Analytics" row would misrepresent what's actually
// happening, which the plan calls out by name.
export const cookieCategories: CookieCategory[] = [
  {
    category: "Essential",
    examples: "Session cookie (httpOnly refresh token)",
    purpose:
      "Keeps you signed in and secures your session. Required for the platform to function; it can't be disabled.",
  },
  {
    category: "Functional",
    examples: "Theme preference, wishlist storage",
    purpose:
      "Remembers your light/dark mode choice and the artworks you've saved to your wishlist across visits.",
  },
];

export const cookiesSections: LegalSection[] = [
  {
    id: "overview",
    heading: "Overview",
    body: [
      "GalleryZone uses a small number of cookies and browser storage entries to keep the site working and to remember your preferences. We do not run any analytics or advertising cookies today; the table below is a complete list, not a partial one.",
    ],
  },
  {
    id: "cookie-categories",
    heading: "Cookie Categories",
    body: [],
  },
  {
    id: "managing-cookies",
    heading: "Managing Cookies",
    body: [
      "Because the Essential category is required for sign-in and checkout security, it can't be turned off while still using GalleryZone. You can clear Functional data (theme preference and wishlist) at any time by clearing your browser's local storage for this site, or by asking us at galleryzone@zohomail.in.",
    ],
  },
];
