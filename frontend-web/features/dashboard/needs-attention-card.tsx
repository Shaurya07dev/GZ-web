"use client";

import Link from "next/link";
import { CircleAlert, CircleCheckBig } from "lucide-react";
import { useArtistAttentionItems } from "@/hooks/useArtistAttentionItems";

export function NeedsAttentionCard() {
  const { items } = useArtistAttentionItems();

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-base font-semibold text-foreground">
        Needs attention
      </h2>

      {items.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheckBig
            className="size-4 shrink-0 text-gold-bright"
            strokeWidth={1.75}
          />
          You&apos;re all caught up.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-2.5 text-sm text-foreground/90 hover:text-foreground"
              >
                <CircleAlert
                  className="size-4 shrink-0 text-gold-bright"
                  strokeWidth={1.75}
                />
                {item.message}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
