"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import Link from "next/link";
import { Store } from "lucide-react";

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// The Topbar already renders the page's <h1> ("Dashboard"), so this is an
// <h2> — a second <h1> here would be a duplicate top-level heading.
export function DashboardGreeting() {
  const { data: me } = useCurrentUser();
  const firstName = me?.name.split(" ")[0] ?? "there";

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          {timeOfDayGreeting()}, {firstName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what needs your attention.
        </p>
      </div>
      <Link
        href="/marketplace"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-gold/40 hover:bg-gold/5 hover:text-gold-bright"
      >
        <Store className="size-3.5" strokeWidth={1.75} />
        View site
      </Link>
    </div>
  );
}
