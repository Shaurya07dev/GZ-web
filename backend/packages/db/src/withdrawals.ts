// Withdrawal requests — Phase 4's payout flow. requestWithdrawal() checks
// the requester's actual ledger balance (summed from ledger_entries, not a
// cached counter) and the policy minimum before creating a request;
// approveWithdrawal() posts the real discharge-the-payable postings via
// withdrawalPayoutPostings (packages/domain) — the same function
// settlement.ts already defines and settlement.check.ts already proved
// balances — through postLedgerEntries, so the payout is reflected in the
// ledger the moment it's approved, not just in the withdrawal_requests row.

import { and, eq, sql } from "drizzle-orm";
import { meetsMinWithdrawal, withdrawalPayoutPostings, withdrawalStateMachine, type PricingRates } from "@galleryzone/domain";
import type { Db } from "./client.ts";
import { postLedgerEntries } from "./ledger-repository.ts";
import { ledgerAccounts, ledgerEntries, withdrawalRequests } from "./schema/ledger.ts";

export class WithdrawalError extends Error {}

type WithdrawableAccountType = Extract<
  (typeof ledgerAccounts.$inferSelect)["type"],
  "artist_payable" | "aggregator_payable" | "customer_wallet"
>;

// Postings' sign convention (see packages/domain/settlement.ts) records a
// LIABILITY recognition (e.g. "GalleryZone owes this artist ₹X") as a
// NEGATIVE amount on the owner's own account — it's the residual/debit
// side of the transaction that captured money elsewhere (escrow). The
// discharge posting (withdrawalPayoutPostings) then adds back the same
// positive amount to cancel it. So the sum of raw postings for an owner's
// account is the NEGATIVE of what's actually owed to them — this function
// flips the sign so "balance" reads the way a human (and every caller
// below) expects: positive = available to withdraw.
async function currentBalance(db: Db, accountType: WithdrawableAccountType, ownerId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amountPaise}), 0)` })
    .from(ledgerEntries)
    .innerJoin(ledgerAccounts, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .where(and(eq(ledgerAccounts.ownerId, ownerId), eq(ledgerAccounts.type, accountType)));
  return -Number(row?.total ?? 0) || 0; // normalize -0, see wallets.ts's identical comment
}

export async function requestWithdrawal({
  db,
  userId,
  accountType,
  amountPaise,
  rates,
}: {
  db: Db;
  userId: string;
  accountType: WithdrawableAccountType;
  amountPaise: number;
  rates: PricingRates;
}): Promise<{ withdrawalId: string }> {
  if (!meetsMinWithdrawal(amountPaise, rates)) {
    throw new WithdrawalError(`Amount is below the minimum withdrawal (₹${rates.minWithdrawalPaise / 100})`);
  }
  const balance = await currentBalance(db, accountType, userId);
  if (amountPaise > balance) {
    throw new WithdrawalError(`Requested amount (${amountPaise}) exceeds available balance (${balance})`);
  }

  const [row] = await db.insert(withdrawalRequests).values({ userId, amountPaise, status: "pending" }).returning({ id: withdrawalRequests.id });
  if (!row) throw new WithdrawalError("insert into withdrawal_requests returned no row");
  return { withdrawalId: row.id };
}

export async function approveWithdrawal(db: Db, withdrawalId: string, accountType: WithdrawableAccountType): Promise<{ transactionId: string }> {
  const [request] = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, withdrawalId));
  if (!request) throw new WithdrawalError(`No withdrawal request ${withdrawalId}`);
  withdrawalStateMachine.assertTransition(request.status, "completed");

  const postings = withdrawalPayoutPostings({ accountType, ownerId: request.userId, amountPaise: request.amountPaise });
  const { transactionId } = await postLedgerEntries(db, { postings, idempotencyPrefix: `withdrawal:${withdrawalId}` });

  await db.update(withdrawalRequests).set({ status: "completed", processedAt: new Date() }).where(eq(withdrawalRequests.id, withdrawalId));
  return { transactionId };
}

export async function rejectWithdrawal(db: Db, withdrawalId: string): Promise<void> {
  const [request] = await db.select({ status: withdrawalRequests.status }).from(withdrawalRequests).where(eq(withdrawalRequests.id, withdrawalId));
  if (!request) throw new WithdrawalError(`No withdrawal request ${withdrawalId}`);
  withdrawalStateMachine.assertTransition(request.status, "rejected");
  await db.update(withdrawalRequests).set({ status: "rejected", processedAt: new Date() }).where(eq(withdrawalRequests.id, withdrawalId));
}
