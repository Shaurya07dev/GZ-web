import type { WalletTransaction } from "@/features/dashboard/dashboard-data";
import { mockDelay, mockError } from "@/lib/mock-utils";
import {
  customerProfileCol,
  customerWalletCol,
  customerWalletTransactionsCol,
} from "@/lib/mock-collections";

// This balance is refund credit and resale proceeds. It is applied
// automatically at the collector's next checkout — but it is their money, so
// they can also take it out, which is what the bank details on CustomerProfile
// exist for. A refund on a ₹1,36,500 painting that can only be spent back on
// the same site is not a refund.
export const MIN_CUSTOMER_WITHDRAWAL = 500;

export const customerWalletService = {
  getWallet: (): Promise<{
    balance: number;
    pendingBalance: number;
    lockedBalance: number;
  }> => mockDelay(customerWalletCol.get()),

  listTransactions: (): Promise<WalletTransaction[]> =>
    mockDelay(customerWalletTransactionsCol.get()),

  // Refuses in the service, not just by hiding the button, so a stale tab
  // cannot ask for money with no account to send it to.
  requestWithdrawal: (amount: number): Promise<WalletTransaction> => {
    const profile = customerProfileCol.get();
    if (!profile.bankAccountNumber || !profile.bankIfsc) {
      return mockError(
        "Add your bank details below before withdrawing — we need somewhere to send it",
      );
    }

    const wallet = customerWalletCol.get();
    if (amount < MIN_CUSTOMER_WITHDRAWAL) {
      return mockError(
        `Minimum withdrawal is ₹${MIN_CUSTOMER_WITHDRAWAL.toLocaleString("en-IN")}`,
      );
    }
    if (amount > wallet.balance) return mockError("Exceeds your balance");

    customerWalletCol.set({ ...wallet, balance: wallet.balance - amount });

    const transaction: WalletTransaction = {
      id: `wt-${crypto.randomUUID().slice(0, 8)}`,
      type: "withdrawal",
      label: `Withdrawal to bank ${profile.bankAccountNumber.slice(-4)}`,
      amount: -amount,
      date: new Date().toISOString().slice(0, 10),
      status: "pending",
    };
    customerWalletTransactionsCol.set([
      transaction,
      ...customerWalletTransactionsCol.get(),
    ]);

    return mockDelay(transaction);
  },
};
