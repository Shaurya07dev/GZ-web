import { useArtistDashboardArtworks } from "./useArtistArtworks";
import { usePendingSettlements } from "./useArtistWallet";
import { VERIFICATION_TIERS } from "@/features/dashboard/dashboard-data";

export interface AttentionItem {
  id: string;
  message: string;
  href: string;
}

// Same real signals (draft artworks, artworks awaiting curator review,
// unpaid settlements, incomplete verification) feed both the mobile
// dashboard's single "next action" prompt and its full "needs attention"
// list — centralized here once so the two can't quietly drift out of sync.
export function useArtistAttentionItems(): {
  items: AttentionItem[];
  isLoading: boolean;
} {
  const { data: artworks, isLoading: artworksLoading } =
    useArtistDashboardArtworks();
  const { data: pendingSettlements, isLoading: settlementsLoading } =
    usePendingSettlements();

  const draftCount = artworks?.filter((a) => a.status === "draft").length ?? 0;
  const reviewCount =
    artworks?.filter((a) => a.status === "pending_approval").length ?? 0;
  const tier3 = VERIFICATION_TIERS.find((t) => t.tier === 3);

  const items: AttentionItem[] = [];

  if (draftCount > 0) {
    items.push({
      id: "drafts",
      message: `${draftCount} artwork${draftCount > 1 ? "s" : ""} still in draft`,
      href: "/dashboard/artworks",
    });
  }
  if (reviewCount > 0) {
    items.push({
      id: "review",
      message: `${reviewCount} artwork${reviewCount > 1 ? "s" : ""} awaiting curator review`,
      href: "/dashboard/artworks",
    });
  }
  if (pendingSettlements && pendingSettlements.length > 0) {
    items.push({
      id: "settlements",
      message: `${pendingSettlements.length} settlement${pendingSettlements.length > 1 ? "s" : ""} pending payout`,
      href: "/dashboard/settlements",
    });
  }
  if (tier3 && tier3.status !== "complete") {
    items.push({
      id: "verification",
      message: "Complete your first sale to unlock the Gold ✦ Verified badge",
      href: "/dashboard/verification",
    });
  }

  return { items, isLoading: artworksLoading || settlementsLoading };
}
