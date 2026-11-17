// Run: node --experimental-strip-types lib/inventory-filters.check.ts

import assert from "node:assert/strict";
import { NO_FILTERS, activeFilterCount, applyInventory, inventoryFacets, isFiltering, matchesQuery, type InventoryFilters } from "./inventory-filters.ts";

const piece = (id: string, over: Record<string, unknown> = {}, price = 20_000) =>
  ({
    id,
    title: `Piece ${id}`,
    artistName: "Meera Kulkarni",
    category: "painting",
    medium: "acrylic-on-canvas",
    artistLocation: "Hyderabad",
    yearCreated: 2024,
    verifiedArtist: false,
    exclusive: false,
    rarityType: null,
    sizeBand: "medium",
    offer: { offerPrice: price },
    ...over,
  }) as Parameters<typeof matchesQuery>[0];

const shelf = [
  piece("a", { title: "Monsoon Window", artistName: "Asha Rao", medium: "oil-on-canvas", rarityType: "R", verifiedArtist: true, sizeBand: "large" }, 80_000),
  piece("b", { title: "Lotus Pond", artistName: "Ravi Menon", exclusive: true, rarityType: "U", sizeBand: "small" }, 8_000),
  piece("c", { title: "Blue Hour", artistName: "Asha Rao", medium: "watercolor", artistLocation: "Pune" }, 30_000),
  piece("d", { title: "Quiet Field", category: "drawing", medium: "charcoal", sizeBand: null }, 150_000),
];
const ids = (list: { id: string }[]) => list.map((p) => p.id);
const run = (query: string, f: Partial<InventoryFilters> = {}, sort: "newest" | "price_asc" | "price_desc" = "newest") =>
  ids(applyInventory(shelf, query, { ...NO_FILTERS, ...f }, sort));

// Search: every word, any of title / artist / medium / category / place / year, slugs and words alike.
assert.deepEqual(run(""), ["a", "b", "c", "d"], "no query keeps everything in the API's order");
assert.deepEqual(run("asha"), ["a", "c"], "by artist");
assert.deepEqual(run("lotus"), ["b"], "by title");
assert.deepEqual(run("oil on canvas"), ["a"], "a typed medium finds the slug");
assert.deepEqual(run("acrylic canvas"), ["b"], "words in any order");
assert.deepEqual(run("pune"), ["c"], "by place");
assert.deepEqual(run("2024 watercolor"), ["c"], "every word has to match");
assert.deepEqual(run("  ASHA   "), ["a", "c"], "case and spaces do not matter");
assert.deepEqual(run("nothing like this"), [], "no match is an empty list");

// Filters.
assert.deepEqual(run("", { category: "drawing" }), ["d"], "category chip");
assert.deepEqual(run("", { mediums: ["oil-on-canvas", "watercolor"] }), ["a", "c"], "mediums are OR");
assert.deepEqual(run("", { ranks: ["R", "U"] }), ["a", "b"], "ranks are OR, unranked never match");
assert.deepEqual(run("", { size: "small" }), ["b"], "size");
assert.deepEqual(run("", { price: 0 }), ["b"], "under 10,000");
assert.deepEqual(run("", { price: 2 }), ["c"], "25,000 to 50,000 includes 30,000");
assert.deepEqual(run("", { price: 4 }), ["d"], "above 1,00,000");
assert.deepEqual(run("", { verifiedOnly: true }), ["a"], "verified artists only");
assert.deepEqual(run("", { exclusiveOnly: true }), ["b"], "exclusive only");
assert.deepEqual(run("asha", { size: "large" }), ["a"], "search and filters together");
assert.deepEqual(run("", { price: 1 }), [], "a band nothing is in");
const savedIds = new Set(["b", "d"]);
const runSaved = (query: string, f: Partial<InventoryFilters> = {}) => ids(applyInventory(shelf, query, { ...NO_FILTERS, ...f }, "newest", savedIds));
assert.deepEqual(runSaved("", { savedOnly: true }), ["b", "d"], "Saved shows only hearted pieces");
assert.deepEqual(runSaved("", { savedOnly: true, category: "drawing" }), ["d"], "Saved and a category chip together");
assert.deepEqual(run("", { savedOnly: true }), [], "nothing is saved when no ids are given");
assert.deepEqual(runSaved(""), ["a", "b", "c", "d"], "without the chip, saving changes nothing");

// Sort never changes the shelf it was given.
assert.deepEqual(run("", {}, "price_asc"), ["b", "c", "a", "d"]);
assert.deepEqual(run("", {}, "price_desc"), ["d", "a", "c", "b"]);
assert.deepEqual(ids(shelf), ["a", "b", "c", "d"], "the original array keeps its order");

// Badge and "is anything applied".
assert.equal(activeFilterCount(NO_FILTERS), 0);
assert.equal(activeFilterCount({ ...NO_FILTERS, mediums: ["x", "y"], size: "small", price: 0, verifiedOnly: true }), 5);
assert.equal(activeFilterCount({ ...NO_FILTERS, category: "painting" }), 0, "the category chip is not in the panel");
assert.equal(isFiltering("", NO_FILTERS), false);
assert.equal(isFiltering("  ", NO_FILTERS), false);
assert.equal(isFiltering("a", NO_FILTERS), true);
assert.equal(isFiltering("", { ...NO_FILTERS, category: "painting" }), true);
assert.equal(isFiltering("", { ...NO_FILTERS, savedOnly: true }), true);
assert.equal(activeFilterCount({ ...NO_FILTERS, savedOnly: true }), 0, "the Saved chip is not in the panel");

// Facets count what is there.
const facets = inventoryFacets(shelf);
assert.deepEqual(facets.categories, ["drawing", "painting"]);
assert.deepEqual(facets.mediums, [["acrylic-on-canvas", 1], ["charcoal", 1], ["oil-on-canvas", 1], ["watercolor", 1]], "ties break by name");
assert.deepEqual(facets.ranks, { R: 1, U: 1 });
assert.deepEqual(facets.sizes, { large: 1, small: 1, medium: 1 }, "a piece with no size band is not counted");
assert.deepEqual(facets.prices, [1, 0, 1, 1, 1]);
assert.equal(facets.verified, 1);
assert.equal(facets.exclusive, 1);

console.log("inventory-filters.check.ts: ok");
