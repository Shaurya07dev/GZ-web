import { cn, formatINR } from "@/lib/utils";

interface PriceTagProps {
  amount: number;
  className?: string;
  /** Add a muted "incl. GST" caption below the figure. Client (18 Oct 2026)
   *  wants every surface that quotes a final price to say so. */
  showGstNote?: boolean;
}

// Every ₹ amount in the app should render through this, never a bare
// formatINR() call — `tabular-nums` keeps digits fixed-width so prices line
// up cleanly in grids (card footers, holdings tables, etc). Font size/color
// are left overridable via className (twMerge resolves the conflict) since
// the same tag renders small in a card footer and large on a detail page.
export function PriceTag({ amount, className, showGstNote = false }: PriceTagProps) {
  const tag = (
    <span
      className={cn(
        "font-display text-lg font-semibold tabular-nums text-foreground",
        className,
      )}
    >
      {formatINR(amount)}
    </span>
  );
  if (!showGstNote) return tag;
  return (
    <span className="inline-flex flex-col leading-none">
      {tag}
      <span className="mt-0.5 text-[10px] font-normal text-muted-foreground">incl. GST</span>
    </span>
  );
}
