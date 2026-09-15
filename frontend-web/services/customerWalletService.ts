import type { WalletTransaction } from "@/features/dashboard/dashboard-data";
import { http } from "@/lib/api";
import { paiseToRupees } from "@/lib/api-mappers";

// This balance is refund credit and resale proceeds. It is applied
// automatically at the collector's next checkout — but it is their money, so
// they can also take it out, which is what the bank details on CustomerProfile
// exist for. A refund on a ₹1,36,500 painting that can only be spent back on
// the same site is not a refund.
export const MIN_CUSTOMER_WITHDRAWAL = 500;

export const customerWalletService = {
  getWallet: async (): Promise<{
    balance: number;
    pendingBalance: number;
    lockedBalance: number;
  }> => {
    const w = await http.get<{ balancePaise: number }>("/v1/customer/wallet");
    return { balance: paiseToRupees(w.balancePaise), pendingBalance: 0, lockedBalance: 0 };
  },

  // The customer wallet has no transaction feed route yet — an empty list,
  // not a fixture one.
  listTransactions: async (): Promise<WalletTransaction[]> => [],

  // Customer wallet withdrawals aren't a backend operation yet: the balance
  // is applied automatically at checkout. Refused loudly, not faked.
  requestWithdrawal: async (_amount: number): Promise<WalletTransaction> => {
    throw new Error("Wallet credit is applied at your next checkout. Bank withdrawals for collectors are coming soon.");
  },
};
