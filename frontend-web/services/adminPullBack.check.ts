// Run: node --import ./scripts/alias-loader.mjs --experimental-strip-types \
//        services/adminPullBack.check.ts
//
// Admin pull-back — GalleryZone reclaiming a piece from an aggregator mid-
// placement. Requested but never built; this is the first check it gets.
//
// Two rules, both about the aggregator's money, since a wrong figure here is a
// wrong figure in someone's wallet:
//
//   1. The advance is ALWAYS released — it was locked, never spent, and a
//      pull-back is not the aggregator's fault by default.
//   2. The delivery deposit is the admin's per-case call (refundDelivery),
//      not a rule baked into the code. Off by default charges it, same as an
//      unsold return; on refunds it.
//
// And a structural one: the admin side cannot see a placement at all through
// artwork.status (aggregatorService.ts deliberately never mutates it), so
// activeHoldingFor() is the only path admin has — that has to actually work.

import assert from "node:assert/strict";

const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
};

const { aggregatorService } = await import("./aggregatorService.ts");
const { adminService } = await import("./adminService.ts");
const { aggregatorProfileCol, aggregatorWalletCol, holdingsCol } =
  await import("@/lib/mock-collections");

function sign(): void {
  aggregatorProfileCol.set({
    ...aggregatorProfileCol.get(),
    mouAcceptance: {
      acceptedAt: new Date().toISOString(),
      signatureName: "Check",
      version: "2026.1",
      signatureDataUrl: null,
    },
  });
}

function reset(): void {
  store.clear();
}

async function reserveOne(): Promise<string> {
  sign();
  aggregatorWalletCol.set({ ...aggregatorWalletCol.get(), balance: 5_000_000 });
  const [artwork] = await aggregatorService.listReservableInventory();
  await aggregatorService.reserve(artwork.id);
  return artwork.id;
}

// --- Nothing to pull back on a clean piece -----------------------------------

reset();
{
  const held = await adminService.activeHoldingFor("nonexistent-artwork-id");
  assert.equal(held, null, "an unplaced artwork has no active holding");
}

// --- activeHoldingFor is admin's only window into a live placement -----------

reset();
{
  const artworkId = await reserveOne();
  const holding = await adminService.activeHoldingFor(artworkId);
  assert.ok(holding, "the admin side can see the placement");
  assert.equal(holding!.status, "reserved");
  assert.equal(holding!.artworkId, artworkId);
}

// --- Pull back: advance always released, delivery off by default -------------

reset();
{
  const artworkId = await reserveOne();
  const before = aggregatorWalletCol.get();
  const holding = (await adminService.activeHoldingFor(artworkId))!;

  const result = await adminService.pullBackHolding({
    holdingId: holding.id,
    reason: "Check: default path",
    refundDelivery: false,
  });

  assert.equal(
    result.released,
    holding.advanceAmount,
    "the advance is always released on pull-back",
  );
  const deliveryDeposit = holding.deliveryDeposit ?? 0;
  assert.equal(
    result.deliveryCharged,
    deliveryDeposit,
    "delivery is charged by default, same as an unsold return",
  );

  const after = aggregatorWalletCol.get();
  assert.equal(
    after.lockedBalance,
    before.lockedBalance - (holding.advanceAmount + deliveryDeposit),
    "the whole hold is released from lockedBalance",
  );
  assert.equal(
    after.balance,
    before.balance - deliveryDeposit,
    "only the forfeited delivery leg actually leaves the balance",
  );

  const gone = await adminService.activeHoldingFor(artworkId);
  assert.equal(gone, null, "the placement no longer shows as active");

  const stillReservable = (
    await aggregatorService.listReservableInventory()
  ).some((a) => a.id === artworkId);
  assert.ok(stillReservable, "the piece is reservable again after pull-back");
}

// --- Pull back with the delivery deposit refunded -----------------------------

reset();
{
  const artworkId = await reserveOne();
  const before = aggregatorWalletCol.get();
  const holding = (await adminService.activeHoldingFor(artworkId))!;

  const result = await adminService.pullBackHolding({
    holdingId: holding.id,
    reason: "Check: refunded path",
    refundDelivery: true,
  });

  assert.equal(
    result.released,
    holding.advanceAmount + (holding.deliveryDeposit ?? 0),
    "refunding delivery releases the whole hold, not just the advance",
  );
  assert.equal(result.deliveryCharged, 0, "nothing is charged when refunded");

  const after = aggregatorWalletCol.get();
  assert.equal(
    after.balance,
    before.balance,
    "the balance is untouched when the delivery is refunded",
  );
}

// --- Guards: a reason is required, and only a live placement can be pulled ---

reset();
{
  const artworkId = await reserveOne();
  const holding = (await adminService.activeHoldingFor(artworkId))!;

  await assert.rejects(
    () =>
      adminService.pullBackHolding({
        holdingId: holding.id,
        reason: "   ",
        refundDelivery: false,
      }),
    /why/i,
    "an empty reason is refused",
  );

  await adminService.pullBackHolding({
    holdingId: holding.id,
    reason: "Check: pulling back once",
    refundDelivery: false,
  });

  await assert.rejects(
    () =>
      adminService.pullBackHolding({
        holdingId: holding.id,
        reason: "Check: pulling back twice",
        refundDelivery: false,
      }),
    /already come back/,
    "a piece already pulled back cannot be pulled back again",
  );
}

// --- A returned holding stays counted for the cycle, like every other return -

reset();
{
  const artworkId = await reserveOne();
  const holding = (await adminService.activeHoldingFor(artworkId))!;
  await adminService.pullBackHolding({
    holdingId: holding.id,
    reason: "Check: cycle counting",
    refundDelivery: false,
  });

  const kept = holdingsCol.get().find((h) => h.id === holding.id);
  assert.ok(kept, "the holding record is kept, not deleted");
  assert.equal(kept!.status, "returned");
}

console.log("services/adminService.ts pull-back checks passed");
