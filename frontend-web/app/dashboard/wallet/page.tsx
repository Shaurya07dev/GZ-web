import type { Metadata } from "next";
import { WalletOverview } from "@/features/dashboard/wallet-overview";

export const metadata: Metadata = {
  title: "Earnings | GalleryZone",
};

export default function DashboardWalletPage() {
  return <WalletOverview />;
}
