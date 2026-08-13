"use client";

import {
  ImageIcon,
  ShoppingBag,
  UserRound,
  Banknote,
  Receipt,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminActivity } from "@/hooks/useAdminDashboard";
import { ADMIN_TODAY } from "@/features/admin/admin-data";
import type { AdminActivityEvent } from "@/types/admin";

const KIND_ICON: Record<AdminActivityEvent["kind"], LucideIcon> = {
  artwork: ImageIcon,
  order: ShoppingBag,
  user: UserRound,
  withdrawal: Banknote,
  settlement: Receipt,
};

// Relative time against the fixed mock anchor, never Date.now() — see
// features/admin/admin-data.ts's ADMIN_TODAY for why.
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = ADMIN_TODAY.getTime() - then;
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export function AdminActivityFeed() {
  const { data: events, isPending } = useAdminActivity();

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-display text-base font-semibold text-foreground">
          Recent activity
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Across the whole platform, newest first.
        </p>
      </div>

      <ul className="divide-y divide-border">
        {isPending
          ? Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                <Skeleton className="size-8 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </li>
            ))
          : (events ?? []).map((event) => {
              const Icon = KIND_ICON[event.kind];
              return (
                <li
                  key={event.id}
                  className="flex items-start gap-3 px-5 py-3.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {event.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {event.detail}
                    </p>
                  </div>
                  <time
                    dateTime={event.at}
                    className="shrink-0 text-xs tabular-nums text-muted-foreground/80"
                  >
                    {relativeTime(event.at)}
                  </time>
                </li>
              );
            })}
      </ul>
    </div>
  );
}
