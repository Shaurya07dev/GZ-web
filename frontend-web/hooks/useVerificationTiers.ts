import { useMemo } from "react";
import { useArtistAccountProfile } from "./useArtistAccount";
import { useArtistDashboardArtworks } from "./useArtistArtworks";

// The three verification tiers, computed from the account's real state:
//   1. a public handle (Instagram or website) on the profile
//   2. the artist agreement (MOU) signed
//   3. a first confirmed sale
// Nothing here is stored — it is a projection of profile + artworks.
export interface VerificationTier {
  tier: 1 | 2 | 3;
  title: string;
  description: string;
  detail: string;
  status: "complete" | "active" | "locked";
  completedOn: string | null;
}

const SOLD = new Set(["sold", "settlement_complete", "delivered", "completed"]);

export function useVerificationTiers() {
  const { data: profile, isPending: profilePending } = useArtistAccountProfile();
  const { data: artworks, isPending: artworksPending } = useArtistDashboardArtworks();

  const tiers = useMemo<VerificationTier[]>(() => {
    const handle = Boolean(profile?.instagram || profile?.website);
    const mou = profile?.mouAcceptance ?? null;
    const firstSale = (artworks ?? [])
      .flatMap((a) => a.statusHistory.filter((e) => SOLD.has(e.status)).map((e) => e.changedAt))
      .sort()[0] ?? null;

    const done = [handle, Boolean(mou), Boolean(firstSale)];
    const firstOpen = done.indexOf(false);
    const statusOf = (i: number): VerificationTier["status"] => (done[i] ? "complete" : i === firstOpen ? "active" : "locked");

    return [
      {
        tier: 1,
        title: "Social media",
        description: "Link an official handle so collectors can verify you.",
        detail: "Add at least one official handle (Instagram or a website) on your profile so collectors can verify you're a real, active artist.",
        status: statusOf(0),
        completedOn: null,
      },
      {
        tier: 2,
        title: "Artist agreement",
        description: "Sign the GalleryZone artist agreement.",
        detail: "Read and sign the Memorandum of Understanding from your profile. It covers listing, sale, settlement and provenance.",
        status: statusOf(1),
        completedOn: mou?.acceptedAt?.slice(0, 10) ?? null,
      },
      {
        tier: 3,
        title: "First sale",
        description: "Complete your first confirmed sale on GalleryZone.",
        detail: "Sell one artwork through the marketplace or a partner gallery. Once confirmed, you'll unlock the Gold ✦ Verified badge on your public profile and listings.",
        status: statusOf(2),
        completedOn: firstSale?.slice(0, 10) ?? null,
      },
    ];
  }, [profile, artworks]);

  const completed = tiers.filter((t) => t.status === "complete").length;
  return { tiers, completed, isPending: profilePending || artworksPending };
}
