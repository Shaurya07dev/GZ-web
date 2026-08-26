// Run: node --import ./scripts/alias-loader.mjs --experimental-strip-types \
//        services/aggregatorWallet.check.ts
//
// One rule, from the client's note: THE ADVANCE IS LOCKED AND CANNOT BE
// WITHDRAWN. The aggregator deposits once, each reservation holds what it
// needs against that deposit, and the held portion stops being theirs to take
// out until the piece sells or comes back.
//
// It was already enforced in two places — requestWithdrawal() refuses more
// than `balance - lockedBalance`, and WithdrawCard caps its input at the same
// figure. Nothing pinned it. This is a money path, so a refactor that quietly
// widened `free` to the whole balance would have let an aggregator withdraw
// money already committed to artwork sitting in someone's gallery.

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
const { aggregatorSalesService } = await import("./aggregatorSalesService.ts");
const { aggregatorProfileCol, aggregatorWalletCol } = await import(
  "@/lib/mock-collections"
);

aggregatorProfileCol.set({
  ...aggregatorProfileCol.get(),
  mouAcceptance: {
    version: "v1",
    acceptedAt: new Date().toISOString(),
    signatureName: "Check",
  },
});

async function withdrawError(amount: number): Promise<string | null> {
  try {
    await aggregatorSalesService.requestWithdrawal(amount);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

// Fund it, then reserve one piece so part of the balance is genuinely held.
const DEPOSIT = 200_000;
await aggregatorSalesService.addFunds(DEPOSIT);

const inventory = await aggregatorService.listReservableInventory();
assert.ok(inventory.length > 0, "the seeds offer something to reserve");
const held = inventory[0].offer.payable;
await aggregatorService.reserve(inventory[0].id);

const wallet = aggregatorWalletCol.get();
assert.equal(wallet.balance, DEPOSIT, "the advance is HELD, not spent");
assert.equal(wallet.lockedBalance, held, "the advance and delivery are locked");

const free = wallet.balance - wallet.lockedBalance;

// The whole balance is not withdrawable — only the unheld part is.
assert.match(
  (await withdrawError(DEPOSIT)) ?? "",
  /is free/,
  "withdrawing the full balance must be refused while an advance is held",
);

// Not even one rupee past the free figure.
assert.ok(
  (await withdrawError(free + 1)) !== null,
  "a rupee more than the free balance must be refused",
);

// And the free part still works, or the lock has become a freeze.
assert.equal(
  await withdrawError(free),
  null,
  "the unheld balance is still the aggregator's to withdraw",
);

assert.equal(
  aggregatorWalletCol.get().balance,
  held,
  "what is left after withdrawing everything free is exactly what was locked",
);

// Commission that has not been settled yet is not spendable either: it lives
// in pendingBalance, which `free` never counts.
aggregatorWalletCol.set({ ...aggregatorWalletCol.get(), pendingBalance: 50_000 });
assert.ok(
  (await withdrawError(50_000)) !== null,
  "pending commission is not withdrawable until it settles",
);

console.log("services/aggregatorSalesService.ts wallet lock checks passed");
