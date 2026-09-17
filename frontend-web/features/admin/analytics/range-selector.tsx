"use client";

import type { RangeKey } from "@/types/admin-analytics";
import { cn } from "@/lib/utils";

const RANGES: Array<{ value: RangeKey; label: string }> = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "12m", label: "12 months" },
];

export function RangeSelector({
  value,
  onChange,
  className,
}: {
  value: RangeKey;
  onChange: (next: RangeKey) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Date range"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5",
        className,
      )}
    >
      {RANGES.map((range) => {
        const active = range.value === value;
        return (
          <button
            key={range.value}
            type="button"
            onClick={() => onChange(range.value)}
            aria-pressed={active}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
