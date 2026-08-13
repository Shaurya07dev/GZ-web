import type { Metadata } from "next";
import { WalletOverview } from "@/features/dashboard/wallet-overview";

export const metadata: Metadata = {
  title: "Wallet | GalleryZone",
};

export default function DashboardWalletPage() {
  return <WalletOverview />;
}
