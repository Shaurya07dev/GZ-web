import type { WalletTransaction } from "@/features/dashboard/dashboard-data";
import { mockDelay } from "@/lib/mock-utils";
import {
  customerWalletCol,
  customerWalletTransactionsCol,
} from "@/lib/mock-collections";

// No withdrawal mutation here, unlike the Artist/Aggregator wallets — this
// balance is refund/return store credit, not earnings the collector cashes
// out. It's applied automatically at the collector's next checkout.
export const customerWalletService = {
  getWallet: (): Promise<{
    balance: number;
    pendingBalance: number;
    lockedBalance: number;
  }> => mockDelay(customerWalletCol.get()),

  listTransactions: (): Promise<WalletTransaction[]> =>
    mockDelay(customerWalletTransactionsCol.get()),
};
