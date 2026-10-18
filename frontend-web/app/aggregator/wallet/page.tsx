import type { Metadata } from "next";
import { WalletOverview } from "@/features/aggregator/wallet-overview";

export const metadata: Metadata = {
  title: "Earnings | GalleryZone Aggregator Portal",
};

export default function AggregatorWalletPage() {
  return <WalletOverview />;
}
