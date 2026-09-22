// Withdrawal requests — Firestore version. requestWithdrawal() checks the
// requester's actual ledger balance (summed live from ledgerEntries, same
// sign-flip convention as the Postgres version — see the comment on
// currentBalance() for why) before creating a request;
// approveWithdrawal() posts the real withdrawalPayoutPostings through the
// ledger repository.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { meetsMinWithdrawal, withdrawalPayoutPostings, withdrawalStateMachine, type PricingRates } from "@galleryzone/domain";
import { postLedgerEntries } from "./ledger-repository.ts";
import { Collections, type LedgerAccountDoc, type LedgerEntryDoc, type WithdrawalRequestDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class WithdrawalError extends DbError {}

export type WithdrawableAccountType = Extract<LedgerAccountDoc["type"], "artist_payable" | "aggregator_payable" | "customer_wallet">;

// Postings' sign convention (see packages/domain/settlement.ts) records a
// LIABILITY recognition as a NEGATIVE amount on the owner's own account —
// this function flips the sign so "balance" reads the way a human (and
// every caller below) expects: positive = available to withdraw.
async function currentBalance(db: Firestore, accountType: WithdrawableAccountType, ownerId: string): Promise<number> {
  const accountSnap = await db.collection(Collections.ledgerAccounts).where("type", "==", accountType).where("ownerId", "==", ownerId).limit(1).get();
  if (accountSnap.empty) return 0;
  const accountId = accountSnap.docs[0]!.id;

  const entriesSnap = await db.collection(Collections.ledgerEntries).where("accountId", "==", accountId).get();
  const sum = entriesSnap.docs.reduce((total, doc) => total + (doc.data() as LedgerEntryDoc).amountPaise, 0);
  return -sum || 0; // `|| 0` normalizes -0 the same way the Postgres version did
}

/**
 * Money already spoken for by requests that haven't been paid out yet.
 *
 * A pending request posts nothing to the ledger — only approval does — so
 * the raw ledger balance says the money is still there. Without this, an
 * artist with a ₹10,000 balance could file five ₹10,000 requests and an
 * admin approving them all would drive the account ₹40,000 negative.
 */
async function pendingRequested(db: Firestore, userId: string): Promise<number> {
  const snap = await db.collection(Collections.withdrawalRequests).where("userId", "==", userId).where("status", "==", "pending").get();
  return snap.docs.reduce((total, doc) => total + (doc.data() as WithdrawalRequestDoc).amountPaise, 0);
}

/** Ledger balance minus anything already requested and not yet settled. */
async function availableToWithdraw(db: Firestore, accountType: WithdrawableAccountType, userId: string): Promise<number> {
  const [balance, pending] = await Promise.all([currentBalance(db, accountType, userId), pendingRequested(db, userId)]);
  return balance - pending;
}

export async function requestWithdrawal({
  db,
  userId,
  accountType,
  amountPaise,
  rates,
}: {
  db: Firestore;
  userId: string;
  accountType: WithdrawableAccountType;
  amountPaise: number;
  rates: PricingRates;
}): Promise<{ withdrawalId: string }> {
  if (!meetsMinWithdrawal(amountPaise, rates)) {
    throw new WithdrawalError(`Amount is below the minimum withdrawal (₹${rates.minWithdrawalPaise / 100})`);
  }
  const available = await availableToWithdraw(db, accountType, userId);
  if (amountPaise > available) {
    throw new WithdrawalError(`Requested amount (${amountPaise}) exceeds available balance (${available})`);
  }

  const ref = db.collection(Collections.withdrawalRequests).doc();
  const doc: WithdrawalRequestDoc = {
    userId,
    amountPaise,
    status: "pending",
    requestedAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
    processedAt: null,
  };
  await ref.set(doc);
  return { withdrawalId: ref.id };
}

export interface WithdrawalRequestView {
  id: string;
  amountPaise: number;
  status: WithdrawalRequestDoc["status"];
  requestedAt: Date;
  processedAt: Date | null;
}

/** The user's own withdrawal requests, newest first. */
export async function listWithdrawalRequests(db: Firestore, userId: string): Promise<WithdrawalRequestView[]> {
  const snap = await db.collection(Collections.withdrawalRequests).where("userId", "==", userId).get();
  return snap.docs
    .map((d) => {
      const w = d.data() as WithdrawalRequestDoc;
      return { id: d.id, amountPaise: w.amountPaise, status: w.status, requestedAt: w.requestedAt?.toDate() ?? new Date(0), processedAt: w.processedAt?.toDate() ?? null };
    })
    .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
}

export async function approveWithdrawal(db: Firestore, withdrawalId: string, accountType: WithdrawableAccountType): Promise<{ transactionId: string }> {
  const ref = db.collection(Collections.withdrawalRequests).doc(withdrawalId);
  const snap = await ref.get();
  if (!snap.exists) throw new WithdrawalError(`No withdrawal request ${withdrawalId}`);
  const request = snap.data() as WithdrawalRequestDoc;
  withdrawalStateMachine.assertTransition(request.status, "completed");

  // Re-check at approval, not just at request time: the balance can have
  // moved since (a reversal, an external-sale fee, another approval), and
  // this is the point where real money leaves. Nothing else stops the
  // ledger going negative.
  const balance = await currentBalance(db, accountType, request.userId);
  if (request.amountPaise > balance) {
    throw new WithdrawalError(`Requested amount (${request.amountPaise}) exceeds available balance (${balance})`);
  }

  const postings = withdrawalPayoutPostings({ accountType, ownerId: request.userId, amountPaise: request.amountPaise });
  const { transactionId } = await postLedgerEntries(db, { postings, idempotencyPrefix: `withdrawal:${withdrawalId}` });

  await ref.update({ status: "completed", processedAt: FieldValue.serverTimestamp() });
  return { transactionId };
}

export async function rejectWithdrawal(db: Firestore, withdrawalId: string): Promise<void> {
  const ref = db.collection(Collections.withdrawalRequests).doc(withdrawalId);
  const snap = await ref.get();
  if (!snap.exists) throw new WithdrawalError(`No withdrawal request ${withdrawalId}`);
  const request = snap.data() as WithdrawalRequestDoc;
  withdrawalStateMachine.assertTransition(request.status, "rejected");
  await ref.update({ status: "rejected", processedAt: FieldValue.serverTimestamp() });
}
