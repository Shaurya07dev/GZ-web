import type { Metadata } from "next";
import { CollectorWalletOverview } from "@/features/account/wallet-overview";

export const metadata: Metadata = {
  title: "Wallet | GalleryZone",
};

export default function AccountWalletPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Wallet
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Store credit from refunds and cancellations.
        </p>
      </div>

      <CollectorWalletOverview />
    </div>
  );
}
