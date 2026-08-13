import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { verifiedTierCount, type ArtistVerificationState } from "@/types/artist";

interface VerifiedBadgeProps {
  verification: ArtistVerificationState;
  size?: "sm" | "md";
  className?: string;
}

// Tier 0 renders nothing — callers that only have a boolean (ArtworkCard,
// which only knows ArtworkSummary.verifiedArtist) should skip rendering
// this entirely rather than pass an all-false verification object; this
// still returns null defensively if one slips through.
// Tier 1-2 renders a subtle "Verified" mark. Tier 3 renders the "Gold ✦
// Verified" treatment (exact copy already established in
// features/dashboard/verification-progress.tsx: "Unlocks the Gold ✦
// Verified badge").
export function VerifiedBadge({
  verification,
  size = "md",
  className,
}: VerifiedBadgeProps) {
  const tierCount = verifiedTierCount(verification);
  if (tierCount === 0) return null;

  const isGold = tierCount === 3;
  const sizing =
    size === "sm"
      ? { icon: "size-3", text: "text-[11px]", gap: "gap-1" }
      : { icon: "size-3.5", text: "text-xs", gap: "gap-1.5" };

  if (isGold) {
    return (
      <span
        className={cn(
          "inline-flex items-center whitespace-nowrap rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 font-medium text-gold-bright",
          sizing.gap,
          sizing.text,
          className
        )}
      >
        <span>Gold</span>
        <span aria-hidden="true">✦</span>
        <span>Verified</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap font-medium text-muted-foreground",
        sizing.gap,
        sizing.text,
        className
      )}
    >
      <BadgeCheck className={cn(sizing.icon, "shrink-0 text-gold-bright")} strokeWidth={2} />
      Verified
    </span>
  );
}
