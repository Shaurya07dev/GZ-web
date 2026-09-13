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

export class WithdrawalError extends Error {}

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
  const balance = await currentBalance(db, accountType, userId);
  if (amountPaise > balance) {
    throw new WithdrawalError(`Requested amount (${amountPaise}) exceeds available balance (${balance})`);
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

export async function approveWithdrawal(db: Firestore, withdrawalId: string, accountType: WithdrawableAccountType): Promise<{ transactionId: string }> {
  const ref = db.collection(Collections.withdrawalRequests).doc(withdrawalId);
  const snap = await ref.get();
  if (!snap.exists) throw new WithdrawalError(`No withdrawal request ${withdrawalId}`);
  const request = snap.data() as WithdrawalRequestDoc;
  withdrawalStateMachine.assertTransition(request.status, "completed");

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
