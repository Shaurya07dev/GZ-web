// Integration check for postLedgerEntries — proves packages/domain's pure
// Posting[] functions actually write correctly through to real
// ledger_entries rows, and that the DB's own CONSTRAINT TRIGGER accepts
// them. Skips gracefully without PGURL (see rate-config-store.check.ts's
// identical pattern).
//
//   PGURL=postgres://postgres:test@localhost:55432/postgres \
//   node --experimental-strip-types packages/db/src/ledger-repository.check.ts

import assert from "node:assert/strict";
import { DEFAULT_RATE_SEED, marketplaceCheckoutPostings } from "@galleryzone/domain";
import { createDb } from "./client.ts";
import { postLedgerEntries } from "./ledger-repository.ts";
import { users } from "./schema/identity.ts";
import { ledgerEntries, ledgerAccounts } from "./schema/ledger.ts";
import { eq } from "drizzle-orm";

const databaseUrl = process.env.PGURL;
if (!databaseUrl) {
  console.log("SKIPPED: set PGURL to a running Postgres to run this integration check");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);

try {
  const [artist] = await db
    .insert(users)
    .values({ firebaseUid: "fb-ledger-test-artist", role: "artist", name: "Ledger Test Artist", email: "ledger-test@example.com" })
    .returning({ id: users.id });
  if (!artist) throw new Error("failed to seed artist");

  const postings = marketplaceCheckoutPostings({
    artistId: artist.id,
    artistPricePaise: 100_000_00,
    rates: DEFAULT_RATE_SEED,
  });

  const { transactionId } = await postLedgerEntries(db, {
    postings,
    idempotencyPrefix: `test-checkout-${artist.id}`,
  });

  const rows = await db.select().from(ledgerEntries).where(eq(ledgerEntries.transactionId, transactionId));
  assert.equal(rows.length, postings.length, "every posting became a ledger_entries row");

  const sum = rows.reduce((total, row) => total + row.amountPaise, 0);
  assert.equal(sum, 0, "the written rows sum to zero — the DB trigger would have rejected the transaction otherwise");

  const artistAccount = await db
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.ownerId, artist.id));
  assert.equal(artistAccount.length, 1, "exactly one artist_payable account was created for this artist");
  assert.equal(artistAccount[0]?.type, "artist_payable");

  // Post a second, unrelated transaction for the SAME artist and confirm
  // it reuses the existing account row rather than creating a second one —
  // this is the "found-or-created per (type, ownerId)" invariant the
  // repository comment promises.
  const secondPostings = marketplaceCheckoutPostings({
    artistId: artist.id,
    artistPricePaise: 50_000_00,
    rates: DEFAULT_RATE_SEED,
  });
  await postLedgerEntries(db, { postings: secondPostings, idempotencyPrefix: `test-checkout-2-${artist.id}` });
  const accountsAfterSecond = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.ownerId, artist.id));
  assert.equal(accountsAfterSecond.length, 1, "the second transaction reused the same account, not a new one");

  console.log("packages/db/ledger-repository.ts: postings write through to a real, balanced, trigger-accepted ledger_entries set");
} finally {
  await close();
}
