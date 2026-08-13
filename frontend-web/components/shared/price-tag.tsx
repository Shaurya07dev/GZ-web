import { cn, formatINR } from "@/lib/utils";

interface PriceTagProps {
  amount: number;
  className?: string;
}

// Every ₹ amount in the app should render through this, never a bare
// formatINR() call — `tabular-nums` keeps digits fixed-width so prices line
// up cleanly in grids (card footers, holdings tables, etc). Font size/color
// are left overridable via className (twMerge resolves the conflict) since
// the same tag renders small in a card footer and large on a detail page.
export function PriceTag({ amount, className }: PriceTagProps) {
  return (
    <span
      className={cn(
        "font-display text-lg font-semibold tabular-nums text-foreground",
        className,
      )}
    >
      {formatINR(amount)}
    </span>
  );
}
