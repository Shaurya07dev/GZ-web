import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Five stars, filled to the nearest half. Used by the artist's own rating
// card, the admin table and each individual review, so a 4.6 looks the same
// everywhere it appears.
export function StarRating({
  value,
  size = "md",
  className,
}: {
  value: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const starSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((position) => {
        // Half-fill is done by clipping a second, filled star over the empty
        // one — no half-star glyph exists in lucide and rounding to whole
        // stars would make 4.4 and 4.6 identical.
        const fill = Math.min(1, Math.max(0, value - position + 1));
        return (
          <span key={position} className="relative inline-flex">
            <Star
              className={cn(starSize, "text-muted-foreground/35")}
              strokeWidth={1.5}
            />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  className={cn(starSize, "fill-gold-bright text-gold-bright")}
                  strokeWidth={1.5}
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
