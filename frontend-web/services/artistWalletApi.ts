// The artist's wallet on the real API: ledger balance, the merged
// transaction feed and withdrawal requests. Amounts arrive in paise and
// leave as rupees; ledger reason codes are mapped to the UI's transaction
// types and labels here, so the components never see wire strings.

import { http } from "@/lib/api";
import { paiseToRupees } from "@/lib/api-mappers";
import type { WalletTransaction } from "@/features/dashboard/dashboard-data";

interface WalletDto {
  balancePaise: number;
  lockedPaise: number;
  availablePaise: number;
}

interface TransactionDto {
  id: string;
  kind: "ledger" | "withdrawal";
  amountPaise: number;
  reason: string;
  status: "completed" | "pending" | "failed";
  at: string;
}

const REASON: Record<string, { type: WalletTransaction["type"]; label: string }> = {
  marketplace_settlement: { type: "settlement", label: "Marketplace sale settled" },
  aggregator_settlement: { type: "settlement", label: "Gallery sale settled" },
  withdrawal: { type: "withdrawal", label: "Withdrawal to bank" },
  withdrawal_payout: { type: "withdrawal", label: "Withdrawal to bank" },
  external_sale_penalty: { type: "adjustment", label: "Off-platform sale fee" },
  refund: { type: "refund", label: "Refund" },
};

function describe(reason: string): { type: WalletTransaction["type"]; label: string } {
  if (REASON[reason]) return REASON[reason];
  if (reason.startsWith("order:")) return { type: "settlement", label: `Order ${reason.slice(6)}` };
  return { type: "adjustment", label: reason.replace(/[_:]/g, " ") };
}

export const artistWalletApi = {
  async getWallet(): Promise<{ balance: number; pendingBalance: number; lockedBalance: number }> {
    const w = await http.get<WalletDto>("/v1/artist/wallet");
    return { balance: paiseToRupees(w.availablePaise), pendingBalance: 0, lockedBalance: paiseToRupees(w.lockedPaise) };
  },

  async listTransactions(): Promise<WalletTransaction[]> {
    const { transactions } = await http.get<{ transactions: TransactionDto[] }>("/v1/artist/wallet/transactions");
    return transactions.map((t) => {
      const { type, label } = describe(t.reason);
      return { id: t.id, type, label, amount: paiseToRupees(t.amountPaise), date: t.at.slice(0, 10), status: t.status };
    });
  },

  async requestWithdrawal(amount: number): Promise<WalletTransaction> {
    const { withdrawalId } = await http.post<{ withdrawalId: string }>("/v1/artist/withdrawals", { amountPaise: Math.round(amount * 100) });
    return { id: withdrawalId, type: "withdrawal", label: "Withdrawal to bank", amount: -amount, date: new Date().toISOString().slice(0, 10), status: "pending" };
  },
};
