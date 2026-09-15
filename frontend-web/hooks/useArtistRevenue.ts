import { useMemo } from "react";
import { useArtistWalletTransactions } from "./useArtistWallet";

// Monthly settlement income for the last six months, from the wallet's
// real transactions. Months with no sales are zero, never invented.
export function useArtistRevenueSeries(months = 6) {
  const { data: transactions, isPending } = useArtistWalletTransactions();
  const series = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; month: string; amount: number }[] = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleString("en-IN", { month: "short" }), amount: 0 });
    }
    for (const t of transactions ?? []) {
      if (t.type !== "settlement" || t.status !== "completed") continue;
      const d = new Date(t.date);
      const bucket = buckets.find((b) => b.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (bucket) bucket.amount += Math.max(0, t.amount);
    }
    return buckets.map(({ month, amount }) => ({ month, amount }));
  }, [transactions, months]);
  return { series, isPending };
}
