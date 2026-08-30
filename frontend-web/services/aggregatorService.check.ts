// Run: node --experimental-strip-types services/aggregatorService.check.ts
//
// The reserve path, end to end, against a clean store — which is exactly what
// a first-time visitor to the deployed site gets. Written after "Artwork no
// longer available" turned up on every card in the inventory grid: three
// different failures shared that one message, so the toast could not say which
// had fired and the grid could not be trusted to agree with the service.
//
// The rule this file holds: ANYTHING the grid offers must be reservable.

import assert from "node:assert/strict";

// localStorage stand-in, installed before the modules under test load.
const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
};

const { aggregatorService } = await import("./aggregatorService.ts");
const { aggregatorProfileCol, aggregatorWalletCol } =
  await import("@/lib/mock-collections");

function reset(): void {
  store.clear();
}

async function reserveError(artworkId: string): Promise<string | null> {
  try {
    await aggregatorService.reserve(artworkId);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

// --- An unsigned aggregator is told about the MOU, not about the artwork ----

reset();
{
  const inventory = await aggregatorService.listReservableInventory();
  assert.ok(inventory.length > 0, "the seeds offer something to reserve");
  const message = await reserveError(inventory[0].id);
  assert.match(
    message ?? "",
    /MOU/,
    `an unsigned aggregator should be told to sign, got: ${message}`,
  );
}

// --- Signed but broke: told about the money, and by how much ----------------

function sign(): void {
  aggregatorProfileCol.set({
    ...aggregatorProfileCol.get(),
    mouAcceptance: {
      acceptedAt: new Date().toISOString(),
      signatureName: "Meher Kapadia",
      version: "2026.1",
      signatureDataUrl: null,
    },
  });
}

reset();
{
  sign();
  const inventory = await aggregatorService.listReservableInventory();
  const message = await reserveError(inventory[0].id);
  assert.match(
    message ?? "",
    /wallet/,
    `a funded-wallet failure should say so, got: ${message}`,
  );
}

// --- Signed and funded: EVERY card in the grid reserves ---------------------
//
// This is the assertion that would have caught the reported bug. The grid and
// reserve() apply overlapping-but-separate conditions, and nothing before now
// checked that the second never refuses what the first offered.

reset();
{
  sign();
  aggregatorWalletCol.set({
    ...aggregatorWalletCol.get(),
    balance: 5_000_000,
  });

  const inventory = await aggregatorService.listReservableInventory();
  assert.ok(inventory.length > 0, "the seeds offer something to reserve");

  for (const artwork of inventory) {
    const message = await reserveError(artwork.id);
    assert.equal(
      message,
      null,
      `the grid offered "${artwork.title}" (${artwork.id}) but reserve() refused it: ${message}`,
    );
  }

  // And what was reserved is gone from the grid, in the collection, and
  // holding money.
  const after = await aggregatorService.listReservableInventory();
  assert.equal(after.length, 0, "everything reservable was reserved");

  const collection = await aggregatorService.listCollection();
  assert.ok(
    collection.length >= inventory.length,
    "reserved pieces are in the collection",
  );

  const wallet = aggregatorWalletCol.get();
  assert.ok(wallet.lockedBalance > 0, "the advances are held, not spent");
  assert.equal(wallet.balance, 5_000_000, "nothing left the wallet");
}

// --- The same piece cannot be reserved twice -------------------------------

reset();
{
  sign();
  aggregatorWalletCol.set({
    ...aggregatorWalletCol.get(),
    balance: 5_000_000,
  });
  const inventory = await aggregatorService.listReservableInventory();
  const first = inventory[0].id;
  await aggregatorService.reserve(first);
  const message = await reserveError(first);
  assert.match(
    message ?? "",
    /Another aggregator reserved this piece first/,
    `a second reserve should say who took it, got: ${message}`,
  );
}

// --- reserve() takes an artwork id and nothing else -------------------------
//
// A `simulateConflict` flag used to sit here, wired to a dev checkbox inside
// the confirm dialog. One stray click on it and every reservation failed with
// "Artwork no longer available" — the checks above all passed the whole time,
// because they call reserve() directly and never touch the dialog. No second
// argument may sabotage a real reservation again.

assert.equal(
  aggregatorService.reserve.length,
  1,
  "reserve() must take only an artwork id — a second argument that can make it fail is how the reported bug happened",
);

// --- The aggregator cannot move the price -----------------------------------
//
// MOU §6 used to give the first aggregator one opportunity to set the selling
// price. That is withdrawn: GalleryZone calculates the price in every month of
// the cycle and the aggregator displays the piece at it. So there is no setter
// to call, and the price a piece is reserved at is the price it carries in the
// collection.

assert.equal(
  (aggregatorService as Record<string, unknown>).updateDisplayPrice,
  undefined,
  "the aggregator has no way to set a selling price — GalleryZone calculates it",
);

reset();
{
  sign();
  aggregatorWalletCol.set({
    ...aggregatorWalletCol.get(),
    balance: 5_000_000,
  });

  const inventory = await aggregatorService.listReservableInventory();
  const offered = new Map(inventory.map((a) => [a.id, a.offer.offerPrice]));
  for (const artwork of inventory) {
    await aggregatorService.reserve(artwork.id);
  }

  // The seeds ship holdings of their own, so only the ones just reserved are
  // compared against the offer they came from.
  const justReserved = (await aggregatorService.listCollection()).filter((h) =>
    offered.has(h.artworkId),
  );
  assert.equal(
    justReserved.length,
    inventory.length,
    "every card reserved turns into a holding",
  );
  for (const holding of justReserved) {
    assert.equal(
      holding.displayPrice,
      offered.get(holding.artworkId),
      `"${holding.artwork.title}" is displayed at the price it was offered at`,
    );
    assert.equal(
      holding.displayPriceSetAt,
      null,
      "nothing on the aggregator side stamps a price",
    );
  }
}

console.log("services/aggregatorService.ts reserve checks passed");
