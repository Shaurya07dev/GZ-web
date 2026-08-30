// Run: node --import ./scripts/alias-loader.mjs --experimental-strip-types \
//        services/artworkRarity.check.ts
//
// R / U / O / N is GalleryZone's ranking, not the artist's claim. Two rules
// follow from that, and the second one is the dangerous one:
//
//   1. A newly submitted artwork is unranked. The artist cannot arrive with
//      their own work already marked Rare.
//   2. An artist editing their listing must not erase the rank an admin set.
//
// Rule 2 nearly shipped broken. updateArtwork() wrote `rarityType:
// patch.rarityType` from the artist's form payload, so the moment the field
// left that form every edit — a typo fix in the title — would have silently
// blanked the admin's ranking. Nothing would have errored; the badge would
// just quietly disappear from the marketplace.

import assert from "node:assert/strict";

const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
};

const { artistDashboardService } = await import("./artistDashboardService.ts");
const { adminService } = await import("./adminService.ts");
const { toSummary } = await import("@/lib/mock-data/helpers");

const submission = {
  title: "Rank Check",
  description: "A piece submitted purely to prove who gets to rank it.",
  category: "painting",
  medium: "Oil on Canvas",
  dimensions: "24x36 in",
  yearCreated: 2026,
  artistPrice: 40_000,
  listingType: "marketplace_only" as const,
  insuranceOpted: false,
  artworkType: null,
  insuranceNumber: null,
  physical: {
    weightKg: 3,
    framing: "framed" as const,
    format: "canvas",
    hangingHardwareIncluded: true,
    packagingConfirmed: true,
  },
  nfcTagId: null,
  images: [],
  mode: "review" as const,
};

// The artist's own input shape has no rank on it at all — this would not
// compile if it did, which is the point.
const created = await artistDashboardService.submitArtwork(submission);

assert.equal(
  created.rarityType,
  null,
  "a new submission is unranked — an artist cannot declare their own work Rare",
);

// GalleryZone ranks it.
const ranked = await adminService.setArtworkRarity(created.id, "R");
assert.equal(ranked.rarityType, "R", "the admin's rank is written");

// The artist now edits something unrelated.
const edited = await artistDashboardService.updateArtwork({
  artworkId: created.id,
  patch: { ...submission, title: "Rank Check, retitled" },
});

assert.equal(edited.title, "Rank Check, retitled", "the edit went through");
assert.equal(
  edited.rarityType,
  "R",
  "editing a listing must not erase the rank GalleryZone gave it",
);

// And the rank reaches the marketplace card, which is the whole visible point.
assert.equal(
  toSummary(edited).rarityType,
  "R",
  "the rank travels to the public summary the marketplace grid renders",
);

// Clearing is the admin's to do, and it sticks.
const cleared = await adminService.setArtworkRarity(created.id, null);
assert.equal(cleared.rarityType, null, "the admin can unrank a piece");

console.log("services/artworkRarity.ts rank ownership checks passed");
