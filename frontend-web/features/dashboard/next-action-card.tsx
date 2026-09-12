"use client";

import Link from "next/link";
import { ArrowRight, PartyPopper } from "lucide-react";
import { useArtistAttentionItems } from "@/hooks/useArtistAttentionItems";

// The single most important thing for the artist to do next, not a list —
// features/dashboard/needs-attention-card.tsx shows the rest of the same
// underlying list. Kept as its own card so it can lead the mobile stack.
export function NextActionCard() {
  const { items, isLoading } = useArtistAttentionItems();
  if (isLoading) return null;

  const top = items[0];

  if (!top) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gold/25 bg-card p-5">
        <PartyPopper
          className="size-5 shrink-0 text-gold-bright"
          strokeWidth={1.75}
        />
        <p className="text-sm text-foreground">You&apos;re all caught up.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gold/25 bg-card p-5">
      <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Next up
      </p>
      <p className="mt-2 text-sm text-foreground">{top.message}</p>
      <Link
        href={top.href}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold-bright hover:underline"
      >
        Continue
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
