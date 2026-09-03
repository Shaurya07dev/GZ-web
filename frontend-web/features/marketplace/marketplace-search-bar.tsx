"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MarketplaceSearchBarProps {
  value: string;
  onChange: (query: string) => void;
  className?: string;
}

// Debounces local keystrokes (300ms) before pushing up to the parent's
// filters state, so useArtworks(filters) - and its 600ms mock delay -
// doesn't refire on every keystroke, only once typing pauses.
export function MarketplaceSearchBar({
  value,
  onChange,
  className,
}: MarketplaceSearchBarProps) {
  const [draft, setDraft] = useState(value);

  // Stay in sync when the parent resets filters from outside this input
  // (e.g. the empty state's "Clear filters" action) — an accepted "adjust
  // state when a prop changes" case (react.dev/learn/you-might-not-need-an-effect).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(draft);
    }, 300);
    return () => clearTimeout(timeout);
    // onChange intentionally excluded: only `draft` should reset the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.75}
      />
      <Input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Search artworks, artists, styles, mediums..."
        aria-label="Search artworks"
        className="h-12 rounded-full border-border bg-card pr-12 pl-11 text-sm shadow-sm"
      />
      <button
        type="button"
        onClick={() => onChange(draft)}
        aria-label="Search"
        className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-gold-deep text-white transition-transform hover:scale-105 active:scale-95"
      >
        <Search className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}
