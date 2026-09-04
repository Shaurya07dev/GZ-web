// Integration check for withdrawal requests, against real Postgres.
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/withdrawals.check.ts

import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { DEFAULT_RATE_SEED, marketplaceCheckoutPostings } from "@galleryzone/domain";
import { createDb } from "./client.ts";
import { postLedgerEntries } from "./ledger-repository.ts";
import { requestWithdrawal, approveWithdrawal, rejectWithdrawal, WithdrawalError } from "./withdrawals.ts";
import { users } from "./schema/identity.ts";
import { withdrawalRequests, ledgerEntries } from "./schema/ledger.ts";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [artist] = await db.insert(users).values({ firebaseUid: "fb-wd-artist", role: "artist", name: "Withdrawal Test Artist", email: "wd-artist@example.com" }).returning({ id: users.id });
  if (!artist) throw new Error("seed failed");

  // Below the minimum is refused before touching the balance at all.
  await assert.rejects(
    () => requestWithdrawal({ db, userId: artist.id, accountType: "artist_payable", amountPaise: 500, rates: DEFAULT_RATE_SEED }),
    WithdrawalError,
  );

  // No balance yet — even an amount above the minimum is refused.
  await assert.rejects(
    () => requestWithdrawal({ db, userId: artist.id, accountType: "artist_payable", amountPaise: DEFAULT_RATE_SEED.minWithdrawalPaise, rates: DEFAULT_RATE_SEED }),
    WithdrawalError,
  );

  // Give the artist a real balance via a real marketplace checkout posting.
  const postings = marketplaceCheckoutPostings({ artistId: artist.id, artistPricePaise: 100_000_00, rates: DEFAULT_RATE_SEED });
  await postLedgerEntries(db, { postings, idempotencyPrefix: `wd-test-checkout-${artist.id}` });

  const { withdrawalId } = await requestWithdrawal({ db, userId: artist.id, accountType: "artist_payable", amountPaise: 50_000_00, rates: DEFAULT_RATE_SEED });
  const [pendingRow] = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, withdrawalId));
  assert.equal(pendingRow?.status, "pending");

  // Requesting more than the remaining balance is refused.
  await assert.rejects(
    () => requestWithdrawal({ db, userId: artist.id, accountType: "artist_payable", amountPaise: 999_999_00, rates: DEFAULT_RATE_SEED }),
    WithdrawalError,
  );

  const { transactionId } = await approveWithdrawal(db, withdrawalId, "artist_payable");
  const [approvedRow] = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, withdrawalId));
  assert.equal(approvedRow?.status, "completed");

  const payoutEntries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.transactionId, transactionId));
  const sum = payoutEntries.reduce((total, e) => total + e.amountPaise, 0);
  assert.equal(sum, 0, "the payout postings balance to zero in the real database");

  // Approving again is illegal (completed -> completed is not a listed transition).
  await assert.rejects(() => approveWithdrawal(db, withdrawalId, "artist_payable"), /Illegal Withdrawal transition/);

  // A second request, rejected instead of approved.
  const { withdrawalId: secondId } = await requestWithdrawal({ db, userId: artist.id, accountType: "artist_payable", amountPaise: DEFAULT_RATE_SEED.minWithdrawalPaise, rates: DEFAULT_RATE_SEED });
  await rejectWithdrawal(db, secondId);
  const [rejectedRow] = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, secondId));
  assert.equal(rejectedRow?.status, "rejected");

  console.log("packages/db/withdrawals.ts: request -> approve/reject flow verified against real Postgres");
} finally {
  await close();
}
