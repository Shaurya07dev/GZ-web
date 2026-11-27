import { useQuery } from "@tanstack/react-query";
import { aggregatorSalesService } from "@/services/aggregatorSalesService";

// There IS NO aggregator wallet / top-up / withdrawal flow — client
// decision, 18 Oct 2026. The aggregator pays the advance + delivery
// per piece through Razorpay at reservation time; commission earned
// on sales sits in GalleryZone's escrow and admin transfers it to the
// aggregator's bank. The names here ("wallet"…) are legacy — the data
// they fetch is now read-only escrow state. Kept as the hook name to
// avoid a wide rename; the UI calls them "Escrow" instead.

export function useAggregatorWallet() {
  return useQuery({
    queryKey: ["aggregator-wallet"],
    queryFn: () => aggregatorSalesService.listWallet(),
  });
}

export function useAggregatorWalletTransactions() {
  return useQuery({
    queryKey: ["aggregator-wallet-transactions"],
    queryFn: () => aggregatorSalesService.listWalletTransactions(),
  });
}
