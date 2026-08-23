import { ARTWORK_RARITY_LABEL, type ArtworkRarity } from "@/types/artwork";
import { cn } from "@/lib/utils";

// The rarity mark that sits over an artwork image, top-right — opposite the
// status pill, which owns the top-left. It spells the word rather than showing
// a bare letter: "R" means nothing to someone seeing it for the first time.
export function RarityBadge({
  rarity,
  className,
}: {
  rarity: ArtworkRarity | null | undefined;
  className?: string;
}) {
  if (!rarity) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-gold/50 bg-background/85 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-gold-bright uppercase backdrop-blur-sm",
        className,
      )}
    >
      <span className="font-bold">{rarity}</span>
      {ARTWORK_RARITY_LABEL[rarity]}
    </span>
  );
}
