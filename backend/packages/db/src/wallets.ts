// Wallet balance reads — artist/aggregator/customer. Reuses the same
// balance derivation withdrawals.ts already proved correct (sum of
// ledger_entries for the owner's account, sign-flipped — see that file's
// currentBalance() comment for why the flip is necessary). Aggregator
// balance is explicitly READ-ONLY (plan.md §3.4 — agent, not principal,
// never a real wallet); this module doesn't expose a withdraw path for it
// for that reason, only the balance view.

import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { ledgerAccounts, ledgerEntries } from "./schema/ledger.ts";

export type WalletAccountType = "artist_payable" | "aggregator_payable" | "customer_wallet";

export interface WalletBalance {
  accountType: WalletAccountType;
  balancePaise: number;
}

export async function getWalletBalance(db: Db, accountType: WalletAccountType, ownerId: string): Promise<WalletBalance> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amountPaise}), 0)` })
    .from(ledgerEntries)
    .innerJoin(ledgerAccounts, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .where(and(eq(ledgerAccounts.ownerId, ownerId), eq(ledgerAccounts.type, accountType)));
  // `|| 0` normalizes -0 (from negating a zero sum) to a plain 0 —
  // JavaScript's -0 is a real, distinct value that trips strict-equality
  // checks (Object.is(-0, 0) is false), and there's no meaningful
  // "negative zero balance" to preserve.
  return { accountType, balancePaise: -Number(row?.total ?? 0) || 0 };
}

export interface WalletTransaction {
  id: string;
  amountPaise: number;
  reason: string;
  createdAt: Date;
}

/** Sign-flipped for the same reason getWalletBalance() is — a positive
 * number here means money that moved TOWARD the owner, not the raw ledger
 * debit/credit convention. */
export async function listWalletTransactions(db: Db, accountType: WalletAccountType, ownerId: string): Promise<WalletTransaction[]> {
  const rows = await db
    .select({ id: ledgerEntries.id, amountPaise: ledgerEntries.amountPaise, reason: ledgerEntries.reason, createdAt: ledgerEntries.createdAt })
    .from(ledgerEntries)
    .innerJoin(ledgerAccounts, eq(ledgerEntries.accountId, ledgerAccounts.id))
    .where(and(eq(ledgerAccounts.ownerId, ownerId), eq(ledgerAccounts.type, accountType)))
    .orderBy(ledgerEntries.createdAt);
  return rows.map((r) => ({ id: r.id, amountPaise: -r.amountPaise, reason: r.reason, createdAt: r.createdAt }));
}
