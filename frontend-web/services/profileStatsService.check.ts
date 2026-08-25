// Run:
//   node --import ./scripts/alias-loader.mjs --experimental-strip-types \
//     services/profileStatsService.check.ts
//
// Two things this file exists to hold:
//
//   1. The privacy line. An artist's PUBLIC stats must never contain a figure
//      the artist's own price could be worked backwards from. The type system
//      separates them; this checks the values actually differ, because a
//      copy-paste that returned the private object from the public function
//      would still typecheck if the shapes ever converged.
//   2. Every stat counts the thing it names. These are derived on read, so the
//      way they break is a predicate quietly drifting from the collection it
//      filters — not a stale number.

import assert from "node:assert/strict";

const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
};

const { profileStatsService } = await import("./profileStatsService.ts");
const { artworksCol, holdingsCol, ordersCol, CURRENT_ARTIST_ID } = await import(
  "@/lib/mock-collections"
);

// --- The artist's own price never reaches a public figure -------------------

{
  const artistId = "meera-nair";
  const pub = await profileStatsService.artistPublic(artistId);
  const listed = artworksCol
    .get()
    .filter((a) => a.artistId === artistId && a.status === "marketplace");

  assert.equal(
    pub.artworksListed,
    listed.length,
    "listed count matches the marketplace artworks",
  );

  // Every price the public stats expose is a CUSTOMER price — the number
  // already printed on the artwork card — and never an artist price.
  if (pub.listedPriceRange) {
    const customerPrices = listed.map((a) => a.customerPrice);
    assert.ok(
      customerPrices.includes(pub.listedPriceRange.low),
      "the low end of the range is a real listed price",
    );
    assert.ok(
      customerPrices.includes(pub.listedPriceRange.high),
      "the high end of the range is a real listed price",
    );
    assert.ok(
      pub.listedPriceRange.low <= pub.listedPriceRange.high,
      "the range is the right way round",
    );
  }

  // The shape itself carries no earnings field. Spelled out rather than left
  // to the type, because this is the assertion someone would have to
  // deliberately delete.
  for (const banned of [
    "lifetimeEarnings",
    "pendingEarnings",
    "averageSalePrice",
    "artistPrice",
  ]) {
    assert.ok(
      !(banned in pub),
      `public stats must not carry "${banned}" — see types/profile-stats.ts`,
    );
  }
}

// --- The demo artist has a real join date, not today -------------------------
//
// She is the signed-in user and deliberately not one of the public fixtures,
// so the lookup misses and used to fall through to new Date().

{
  const pub = await profileStatsService.artistPublic(CURRENT_ARTIST_ID);
  const joined = new Date(pub.joinedAt).getTime();
  assert.ok(
    Date.now() - joined > 86_400_000,
    "the demo artist did not join today",
  );
  assert.ok(pub.verifiedTiers >= 1, "her verification tiers survive the lookup");
}

// --- Counts follow their collections ----------------------------------------

{
  const stats = await profileStatsService.aggregator();
  const holdings = holdingsCol.get();

  assert.equal(
    stats.onDisplay,
    holdings.filter((h) => h.status === "reserved").length,
  );
  assert.equal(
    stats.piecesSold,
    holdings.filter((h) => h.status === "sold_pending_settlement").length,
  );
  assert.ok(
    stats.displayCapacity >= stats.onDisplay,
    "a gallery cannot display more than it has room for",
  );
  assert.ok(stats.owedToGalleryZone >= 0, "never a negative obligation");
}

{
  const stats = await profileStatsService.collector();
  const orders = ordersCol.get();

  assert.equal(stats.ordersPlaced, orders.length);
  assert.equal(
    stats.worksOwned,
    orders.filter((o) => o.status === "delivered").length,
    "owned means delivered",
  );

  // Spend is what was actually charged: the price (GST inside it) plus
  // delivery. Adding gstAmount here would double-count it — the same bug the
  // checkout total had.
  const expected = orders
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + o.amount + o.deliveryCharge, 0);
  assert.equal(stats.totalSpent, expected, "GST is not counted twice");

  assert.ok(
    stats.inProgress <= stats.ordersPlaced,
    "in-progress is a subset of orders",
  );
}

console.log("services/profileStatsService.ts checks passed");
