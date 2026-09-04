// Turns packages/domain/settlement.ts's Posting[] into real ledger_entries
// rows, inside one DB transaction — the "repository layer" that file's own
// header comment describes. Every posting in a call shares one
// transactionId, which is exactly what the ledger-balance CONSTRAINT
// TRIGGER (migrations/0001) checks at COMMIT.
//
// Account rows are found-or-created per (type, ownerId) pair rather than
// minted fresh every call — a user has ONE artist_payable account, not one
// per transaction. Known limitation, documented rather than hidden: this
// does a plain SELECT-then-INSERT with no advisory lock, so two concurrent
// first-ever postings for the same brand-new (type, ownerId) pair could
// each try to create the account row. Low-risk in practice (an account is
// created once per user per type, not on every transaction) and worth a
// real fix (a partial unique index + ON CONFLICT) before Phase 2 goes to
// production traffic — flagged here rather than silently shipped as if it
// were already race-safe.

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Posting } from "@galleryzone/domain";
import type { Db } from "./client.ts";
import { ledgerAccounts, ledgerEntries } from "./schema/ledger.ts";

async function getOrCreateAccount(
  tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
  accountType: Posting["accountType"],
  ownerId: string | undefined,
): Promise<string> {
  const ownerCondition = ownerId ? eq(ledgerAccounts.ownerId, ownerId) : isNull(ledgerAccounts.ownerId);
  const [existing] = await tx
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.type, accountType), ownerCondition));
  if (existing) return existing.id;

  const [created] = await tx
    .insert(ledgerAccounts)
    .values({ type: accountType, ownerId: ownerId ?? null })
    .returning({ id: ledgerAccounts.id });
  if (!created) throw new Error(`failed to create ledger account ${accountType}/${ownerId ?? "system"}`);
  return created.id;
}

export interface PostLedgerEntriesInput {
  postings: Posting[];
  /** Prefix for each posting's idempotency key — must be unique per business event (e.g. an order id). */
  idempotencyPrefix: string;
  relatedOrderId?: string;
  relatedHoldingId?: string;
}

/**
 * Writes a balanced set of postings as ledger_entries rows in one DB
 * transaction, sharing one transaction_id. Relies on the postings already
 * summing to zero (settlement.ts's assertBalanced() guarantees this before
 * this function ever sees them) — the DB's own CONSTRAINT TRIGGER is the
 * final, non-bypassable check.
 */
export async function postLedgerEntries(db: Db, input: PostLedgerEntriesInput): Promise<{ transactionId: string }> {
  const transactionId = randomUUID();

  await db.transaction(async (tx) => {
    for (const [index, posting] of input.postings.entries()) {
      const accountId = await getOrCreateAccount(tx, posting.accountType, posting.ownerId);
      await tx.insert(ledgerEntries).values({
        transactionId,
        accountId,
        amountPaise: posting.amountPaise,
        reason: posting.reason,
        relatedOrderId: input.relatedOrderId ?? null,
        relatedHoldingId: input.relatedHoldingId ?? null,
        idempotencyKey: `${input.idempotencyPrefix}:${index}`,
      });
    }
  });

  return { transactionId };
}
