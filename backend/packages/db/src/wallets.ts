// Wallet balance reads — Firestore version. Same sign-flip convention as
// withdrawals.ts's currentBalance() (kept as a separate, tiny
// implementation here rather than importing that one, since this module
// intentionally has no other dependency on withdrawals.ts).

import type { Firestore } from "firebase-admin/firestore";
import { Collections, type LedgerEntryDoc } from "./collections.ts";

export type WalletAccountType = "artist_payable" | "aggregator_payable" | "customer_wallet";

export interface WalletBalance {
  accountType: WalletAccountType;
  balancePaise: number;
}

export async function getWalletBalance(db: Firestore, accountType: WalletAccountType, ownerId: string): Promise<WalletBalance> {
  const accountSnap = await db.collection(Collections.ledgerAccounts).where("type", "==", accountType).where("ownerId", "==", ownerId).limit(1).get();
  if (accountSnap.empty) return { accountType, balancePaise: 0 };
  const accountId = accountSnap.docs[0]!.id;

  const entriesSnap = await db.collection(Collections.ledgerEntries).where("accountId", "==", accountId).get();
  const sum = entriesSnap.docs.reduce((total, doc) => total + (doc.data() as LedgerEntryDoc).amountPaise, 0);
  return { accountType, balancePaise: -sum || 0 };
}

export interface WalletTransaction {
  id: string;
  amountPaise: number;
  reason: string;
  createdAt: Date;
}

export async function listWalletTransactions(db: Firestore, accountType: WalletAccountType, ownerId: string): Promise<WalletTransaction[]> {
  const accountSnap = await db.collection(Collections.ledgerAccounts).where("type", "==", accountType).where("ownerId", "==", ownerId).limit(1).get();
  if (accountSnap.empty) return [];
  const accountId = accountSnap.docs[0]!.id;

  const entriesSnap = await db.collection(Collections.ledgerEntries).where("accountId", "==", accountId).orderBy("createdAt").get();
  return entriesSnap.docs.map((doc) => {
    const data = doc.data() as LedgerEntryDoc;
    return { id: doc.id, amountPaise: -data.amountPaise, reason: data.reason, createdAt: data.createdAt.toDate() };
  });
}
