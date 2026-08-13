import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

// Centered icon + title + description + optional action slot, reused for
// every "nothing here" moment across every track (no search results, no
// reservations yet, empty wishlist, etc). Deliberately plain (no client
// directive, no motion) so it can be dropped into a Server Component tree
// as easily as a Client one.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border px-6 py-16 text-center",
        className
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full border border-border bg-muted">
        <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {title}
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
